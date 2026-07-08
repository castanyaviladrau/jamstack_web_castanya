const querystring = require('querystring');
require('dotenv').config();
const {
  getOrderValue,
  normalizeBase64Url,
  verifyMerchantParametersSignature,
} = require('./redsys-signature');
const { sendEmail, isBrevoConfigured } = require('./send-email');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET_KEY = process.env.REDSYS_SECRET_KEY;

function response(statusCode, body, contentType = 'text/plain') {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
    },
    body: contentType === 'application/json' ? JSON.stringify(body) : body,
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

function normalizeSignature(signature) {
  return normalizeBase64Url(signature);
}

function verifySignature(merchantParameters, signature, secretKey) {
  return verifyMerchantParametersSignature(merchantParameters, signature, secretKey);
}

function parseEventBody(event) {
  if (!event.body) {
    return {};
  }

  if (typeof event.body === 'object') {
    return event.body;
  }

  const contentType = String(
    event.headers?.['content-type'] || event.headers?.['Content-Type'] || '',
  );

  if (contentType.includes('application/json')) {
    return JSON.parse(event.body);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return querystring.parse(event.body);
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    return querystring.parse(event.body);
  }
}

async function fetchOrderByPaymentReference(paymentReference) {
  const responseResult = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*&payment_reference=eq.${encodeURIComponent(paymentReference)}&limit=1`,
    {
      headers: getSupabaseHeaders(),
    },
  );

  if (!responseResult.ok) {
    const errorText = await responseResult.text();
    throw new Error(`Supabase payment reference lookup failed: ${errorText}`);
  }

  const rows = await responseResult.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function fetchOrderItems(orderId) {
  const responseResult = await fetch(
    `${SUPABASE_URL}/rest/v1/order_items?select=*&order_id=eq.${encodeURIComponent(orderId)}`,
    {
      headers: getSupabaseHeaders(),
    },
  );

  if (!responseResult.ok) {
    const errorText = await responseResult.text();
    throw new Error(`Supabase order items lookup failed: ${errorText}`);
  }

  const rows = await responseResult.json();
  return Array.isArray(rows) ? rows : [];
}

async function updateOrder(orderId, payload) {
  const responseResult = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: getSupabaseHeaders('return=representation'),
      body: JSON.stringify(payload),
    },
  );

  if (!responseResult.ok) {
    const errorText = await responseResult.text();
    throw new Error(`Supabase order update failed: ${errorText}`);
  }

  const rows = await responseResult.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function mergePaymentSnapshot(existingSnapshot, nextSnapshot) {
  if (!existingSnapshot || typeof existingSnapshot !== 'object') {
    return nextSnapshot;
  }

  return {
    ...existingSnapshot,
    ...nextSnapshot,
  };
}

async function sendOrderEmails(order) {
  if (!isBrevoConfigured()) {
    console.log(
      `Brevo not configured, skipping order emails for ${order.public_order_code}`,
    );
    return { skipped: true, reason: 'not_configured' };
  }

  const orderItems = await fetchOrderItems(order.id);
  const shippingAddress = order.shipping_address_json || {};
  const billingAddress = order.billing_address_json || {};
  const emailData = {
    orderId: order.public_order_code,
    items: orderItems.map((item) => ({
      name: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      lineTotal: Number(item.line_total || 0),
    })),
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      fulfillmentMethod: order.fulfillment_method || 'shipping',
      pickupStore: order.pickup_store || '',
      address: shippingAddress.address_line_1 || '',
      city: shippingAddress.city || '',
      postalCode: shippingAddress.postal_code || '',
      country: shippingAddress.country || '',
      notes: order.notes || '',
    },
    billing:
      billingAddress.company_name || billingAddress.address_line_1
        ? {
            company: billingAddress.company_name || '',
            vat: billingAddress.vat_number || '',
            address: billingAddress.address_line_1 || '',
            city: billingAddress.city || '',
            postalCode: billingAddress.postal_code || '',
            country: billingAddress.country || '',
          }
        : null,
  };

  await sendEmail({
    type: 'order-confirmation',
    to: order.customer_email,
    data: emailData,
  });

  await sendEmail({
    type: 'order-notification',
    data: emailData,
  });

  return { skipped: false };
}

exports._test = {
  normalizeSignature,
  verifySignature,
  parseEventBody,
  mergePaymentSnapshot,
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, 'Method not allowed');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return response(500, 'Supabase environment is not configured');
  }

  if (!SECRET_KEY) {
    return response(503, 'Payment provider not configured');
  }

  try {
    const body = parseEventBody(event);
    const merchantParameters = body.Ds_MerchantParameters;
    const signature = body.Ds_Signature;

    if (!merchantParameters || !signature) {
      return response(400, 'Missing callback payload');
    }

    const { isValid, parameters } = verifySignature(
      merchantParameters,
      signature,
      SECRET_KEY,
    );

    if (!isValid) {
      console.error('Payment callback signature mismatch');
      return response(400, 'Invalid signature');
    }

    const responseCode = Number(parameters.Ds_Response || parameters.DS_RESPONSE);
    const paymentReference = getOrderValue(parameters);
    const order = await fetchOrderByPaymentReference(paymentReference);

    if (!order) {
      console.error(
        `Payment callback order not found for reference ${paymentReference}`,
      );
      return response(404, 'Order not found');
    }

    const paymentSnapshot = mergePaymentSnapshot(order.payment_raw_response, {
      callback_received_at: new Date().toISOString(),
      callback_signature_version: body.Ds_SignatureVersion || null,
      callback_response_code: parameters.Ds_Response || parameters.DS_RESPONSE || null,
      callback_payload: parameters,
    });

    if (responseCode >= 0 && responseCode <= 99) {
      if (order.payment_status === 'paid') {
        return response(200, 'OK');
      }

      const updatedOrder = await updateOrder(order.id, {
        status: 'processed',
        payment_status: 'paid',
        fulfillment_status: 'delivered',
        payment_raw_response: paymentSnapshot,
      });

      try {
        await sendOrderEmails(updatedOrder || order);
      } catch (emailError) {
        console.error(
          `Order paid but order emails failed for ${order.public_order_code}:`,
          emailError,
        );
      }

      console.log(
        `Payment successful for order ${order.public_order_code} (${paymentReference})`,
      );
      return response(200, 'OK');
    }

    await updateOrder(order.id, {
      status: 'pending_payment',
      payment_status: 'failed',
      payment_raw_response: paymentSnapshot,
    });

    console.log(
      `Payment failed for order ${order.public_order_code} (${paymentReference}), code: ${responseCode}`,
    );
    return response(200, 'Payment failed');
  } catch (error) {
    console.error('Payment callback error:', error);
    return response(500, 'Error processing payment callback');
  }
};
