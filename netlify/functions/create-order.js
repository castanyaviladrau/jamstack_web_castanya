const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRODUCTS_PATH = path.join(__dirname, '..', '..', 'src', '_data', 'products.json');

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function loadCatalog() {
  const rawCatalog = fs.readFileSync(PRODUCTS_PATH, 'utf8');
  const parsedCatalog = JSON.parse(rawCatalog);
  return Array.isArray(parsedCatalog.list) ? parsedCatalog.list : [];
}

function createOrderCode() {
  const datePart = Date.now().toString().slice(-8);
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CV-${datePart}-${randomPart}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function validateCustomer(customer) {
  const payload = customer || {};
  const requiredFields = ['name', 'email', 'phone', 'country', 'address', 'city', 'postalCode'];
  const missingField = requiredFields.find((field) => !normalizeText(payload[field]));

  if (missingField) {
    throw new Error(`Missing customer field: ${missingField}`);
  }

  return {
    name: normalizeText(payload.name),
    email: normalizeText(payload.email).toLowerCase(),
    phone: normalizeText(payload.phone),
    country: normalizeText(payload.country),
    address: normalizeText(payload.address),
    city: normalizeText(payload.city),
    postalCode: normalizeText(payload.postalCode),
    notes: normalizeText(payload.notes),
  };
}

function buildValidatedItems(rawItems, catalog) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Cart is empty');
  }

  return rawItems.map((item) => {
    const sku = normalizeText(item.sku);
    const quantity = Number(item.quantity);

    if (!sku || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid cart item payload');
    }

    const catalogProduct = catalog.find((product) =>
      Array.isArray(product.variants) && product.variants.some((variant) => variant.sku === sku),
    );

    if (!catalogProduct) {
      throw new Error(`Unknown SKU: ${sku}`);
    }

    const catalogVariant = catalogProduct.variants.find((variant) => variant.sku === sku);
    const unitPrice = Number(catalogVariant.price);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    return {
      sku,
      product_slug: catalogProduct.slug,
      product_name: catalogProduct.name,
      variant_label: catalogVariant.label,
      product_image: catalogProduct.image || null,
      currency: catalogProduct.currency || 'EUR',
      unit_price: unitPrice,
      quantity,
      line_total: lineTotal,
    };
  });
}

async function insertSupabaseRow(table, payload, options = {}) {
  const query = options.returnRepresentation ? '?select=*' : '';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.returnRepresentation ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase ${table} insert failed: ${errorText}`);
  }

  if (!options.returnRepresentation) {
    return null;
  }

  return response.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Supabase environment is not configured' });
  }

  try {
    const { items, customer } = JSON.parse(event.body || '{}');
    const catalog = loadCatalog();
    const validatedCustomer = validateCustomer(customer);
    const validatedItems = buildValidatedItems(items, catalog);
    const subtotalAmount = Number(
      validatedItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2),
    );
    const shippingAmount = 0;
    const totalAmount = Number((subtotalAmount + shippingAmount).toFixed(2));
    const publicOrderCode = createOrderCode();

    const orderPayload = {
      public_order_code: publicOrderCode,
      status: 'pending_payment',
      payment_status: 'pending',
      fulfillment_status: 'unfulfilled',
      currency: 'EUR',
      subtotal_amount: subtotalAmount,
      shipping_amount: shippingAmount,
      total_amount: totalAmount,
      customer_name: validatedCustomer.name,
      customer_email: validatedCustomer.email,
      customer_phone: validatedCustomer.phone,
      shipping_address_json: {
        address_line_1: validatedCustomer.address,
        city: validatedCustomer.city,
        postal_code: validatedCustomer.postalCode,
        country: validatedCustomer.country,
      },
      notes: validatedCustomer.notes || null,
      payment_provider: 'redsys',
    };

    const insertedOrders = await insertSupabaseRow('orders', orderPayload, {
      returnRepresentation: true,
    });
    const insertedOrder = Array.isArray(insertedOrders) ? insertedOrders[0] : null;

    if (!insertedOrder || !insertedOrder.id) {
      throw new Error('Supabase did not return the created order');
    }

    const orderItemsPayload = validatedItems.map((item) => ({
      order_id: insertedOrder.id,
      sku: item.sku,
      product_slug: item.product_slug,
      product_name: item.product_name,
      variant_label: item.variant_label,
      unit_price: item.unit_price,
      quantity: item.quantity,
      line_total: item.line_total,
      product_image: item.product_image,
    }));

    await insertSupabaseRow('order_items', orderItemsPayload);

    return jsonResponse(200, {
      success: true,
      order: {
        id: insertedOrder.id,
        publicOrderCode: insertedOrder.public_order_code,
        status: insertedOrder.status,
        paymentStatus: insertedOrder.payment_status,
        subtotalAmount,
        shippingAmount,
        totalAmount,
        currency: insertedOrder.currency,
        items: validatedItems.map((item) => ({
          sku: item.sku,
          name: item.product_name,
          variantLabel: item.variant_label,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: item.line_total,
        })),
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return jsonResponse(500, {
      success: false,
      error: 'Order creation failed',
      details: error.message,
    });
  }
};
