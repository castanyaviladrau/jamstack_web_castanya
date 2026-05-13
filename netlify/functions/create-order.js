require('dotenv').config();

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getSupabaseHeaders(prefer = 'return=minimal') {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

function createOrderCode() {
  const datePart = Date.now().toString().slice(-8);
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CV-${datePart}-${randomPart}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
}

function isValidInternationalPhone(value) {
  const phone = normalizeText(value);
  if (!/^\+?[0-9\s().-]+$/.test(phone)) {
    return false;
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }

  const plusCount = (phone.match(/\+/g) || []).length;
  return plusCount === 0 || (plusCount === 1 && phone.startsWith('+'));
}

function loadProductsIndex() {
  const filePath = path.join(process.cwd(), 'src', '_data', 'products.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.list) ? parsed.list : [];

  const skuIndex = new Map();
  list.forEach((product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    variants.forEach((variant) => {
      const sku = normalizeText(variant?.sku);
      if (!sku) {
        return;
      }

      skuIndex.set(sku, {
        product_slug: normalizeText(product?.slug),
        product_name: normalizeText(product?.name),
        product_image: normalizeText(product?.image) || null,
        variant_label: normalizeText(variant?.label),
        unit_price: Number(variant?.price),
      });
    });
  });

  return skuIndex;
}

function validateCustomer(customer) {
  const payload = customer || {};
  const requiredFields = ['name', 'email', 'phone', 'country', 'address', 'city', 'postalCode'];
  const missingField = requiredFields.find((field) => !normalizeText(payload[field]));

  if (missingField) {
    throw new Error(`Missing customer field: ${missingField}`);
  }

  if (!isValidEmail(payload.email)) {
    throw new Error('Invalid customer email');
  }

  if (!isValidInternationalPhone(payload.phone)) {
    throw new Error('Invalid customer phone');
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

function buildValidatedItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const productsIndex = loadProductsIndex();

  return rawItems.map((item, index) => {
    const safeItem = item && typeof item === 'object' ? item : {};
    const sku = normalizeText(safeItem.sku);
    const quantity = Number(safeItem.quantity);

    if (!sku) {
      throw new Error(
        `Invalid cart item payload at index ${index}: missing sku`,
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid cart item quantity');
    }

    const resolved = productsIndex.get(sku);
    if (!resolved) {
      throw new Error(`Unknown SKU in cart at index ${index}: ${sku}`);
    }

    if (!Number.isFinite(resolved.unit_price) || resolved.unit_price <= 0) {
      throw new Error(`Invalid price for SKU ${sku}`);
    }

    if (!resolved.product_slug || !resolved.variant_label) {
      throw new Error(`Product index entry is missing slug/label for SKU ${sku}`);
    }

    const lineTotal = Number((resolved.unit_price * quantity).toFixed(2));

    return {
      sku,
      product_slug: resolved.product_slug,
      product_name: resolved.product_name || resolved.product_slug,
      variant_label: resolved.variant_label,
      product_image: resolved.product_image,
      unit_price: resolved.unit_price,
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
      ...getSupabaseHeaders(options.returnRepresentation ? 'return=representation' : 'return=minimal'),
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
    const validatedCustomer = validateCustomer(customer);
    const validatedItems = buildValidatedItems(items);
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
    const statusCode =
      /^Missing customer field:/.test(error.message) ||
      error.message === 'Invalid customer email' ||
      error.message === 'Invalid customer phone' ||
      error.message === 'Cart is empty' ||
      error.message.startsWith('Invalid cart item') ||
      error.message.startsWith('Unknown SKU') ||
      error.message.startsWith('Invalid price') ||
      error.message.startsWith('Product index entry is missing')
        ? 400
        : 500;

    return jsonResponse(statusCode, {
      success: false,
      error: 'Order creation failed',
      details: error.message,
    });
  }
};
