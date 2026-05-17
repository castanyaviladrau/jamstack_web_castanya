const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE;
const SECRET_KEY = process.env.REDSYS_SECRET_KEY;
const REDSYS_URL = process.env.REDSYS_URL || 'https://sis-t.redsys.es:25443/sis/realizarPago';
const SITE_URL = process.env.URL;
const PAYMENT_PROVIDER = String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
const TERMINAL = '001';
const CURRENCY = '978'; // EUR

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

async function fetchSupabaseOrder({ orderId, publicOrderCode }) {
  const filters = [];
  const logicFilters = [];

  if (orderId) {
    filters.push(`id=eq.${encodeURIComponent(orderId)}`);
    logicFilters.push(`id.eq.${encodeURIComponent(orderId)}`);
  }

  if (publicOrderCode) {
    filters.push(`public_order_code=eq.${encodeURIComponent(publicOrderCode)}`);
    logicFilters.push(`public_order_code.eq.${encodeURIComponent(publicOrderCode)}`);
  }

  if (!filters.length) {
    throw new Error('Missing order identifier');
  }

  const query = filters.length > 1 ? `or=(${logicFilters.join(',')})` : filters[0];
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*&limit=1&${query}`,
    {
      headers: getSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase order lookup failed: ${errorText}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateSupabaseOrder(orderId, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders('return=representation'),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase order update failed: ${errorText}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function createMerchantOrderCode(order) {
  const rawSource = `${order.id}${order.public_order_code}${Date.now()}`;
  const digitsOnly = rawSource.replace(/\D/g, '');
  const padded = `${digitsOnly}000000000000`;
  return padded.slice(0, 12);
}

function generateSignature(parameters, key) {
  const order = parameters.Ds_Merchant_Order;
  const keyBytes = Buffer.from(key, 'base64');

  if (keyBytes.length !== 24) {
    throw new Error(
      `Invalid RedSys secret key length. Expected 24 bytes after base64 decode, got ${keyBytes.length}.`,
    );
  }
  const iv = Buffer.alloc(8, 0);
  
  // Encrypt order with 3DES
  const cipher = crypto.createCipheriv('des-ede3-cbc', keyBytes, iv);
  const encrypted = Buffer.concat([cipher.update(order, 'utf8'), cipher.final()]).toString('base64');
  
  // Create HMAC with encrypted key
  const hmac = crypto.createHmac('sha256', Buffer.from(encrypted, 'base64'));
  hmac.update(Buffer.from(JSON.stringify(parameters), 'utf8').toString('base64'));
  
  return hmac.digest('base64');
}

// Expose a small, explicit surface for unit tests.
// This keeps the handler behavior unchanged while allowing node:test to exercise
// signature generation and deterministic helpers without adding deps.
exports._test = {
  createMerchantOrderCode,
  generateSignature,
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Supabase environment is not configured' });
  }

  if (!SITE_URL) {
    return jsonResponse(503, {
      error: 'Payment provider not configured',
      details: 'Missing site URL environment variables',
    });
  }

  const isMockProvider = PAYMENT_PROVIDER === 'mock';
  if (isMockProvider) {
    // TODO: Remove this mock payment-provider path before production hardening to avoid keeping a fake RedSys flow available long-term.
    // In mock mode we still generate signatures so callback verification stays meaningful.
    // Allow a dedicated dev key, falling back to the standard key.
    if (!process.env.REDSYS_SECRET_KEY_DEV && !SECRET_KEY) {
      return jsonResponse(503, {
        error: 'Payment provider not configured',
        details: 'Missing REDSYS_SECRET_KEY (or REDSYS_SECRET_KEY_DEV) for mock signing',
      });
    }
  } else if (!MERCHANT_CODE || !SECRET_KEY) {
    return jsonResponse(503, {
      error: 'Payment provider not configured',
      details: 'Missing RedSys merchant environment variables',
    });
  }

  try {
    const { orderId, publicOrderCode } = JSON.parse(event.body || '{}');
    const order = await fetchSupabaseOrder({ orderId, publicOrderCode });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      return jsonResponse(409, {
        error: 'Order already paid',
        order: {
          id: order.id,
          publicOrderCode: order.public_order_code,
          paymentStatus: order.payment_status,
        },
      });
    }

    const totalAmount = Number(order.total_amount || 0);
    const amountInCents = Math.round(totalAmount * 100);

    if (amountInCents <= 0) {
      return jsonResponse(400, { error: 'Order total is not valid for payment' });
    }

    const merchantOrderCode = order.payment_reference || createMerchantOrderCode(order);

    const parameters = {
      Ds_Merchant_Amount: amountInCents.toString(),
      Ds_Merchant_Order: merchantOrderCode,
      Ds_Merchant_MerchantCode: MERCHANT_CODE || 'MOCK',
      Ds_Merchant_Currency: CURRENCY,
      Ds_Merchant_TransactionType: '0',
      Ds_Merchant_Terminal: TERMINAL,
      Ds_Merchant_MerchantURL: `${SITE_URL}/.netlify/functions/payment-callback`,
      Ds_Merchant_UrlOK: `${SITE_URL}/payment/success`,
      Ds_Merchant_UrlKO: `${SITE_URL}/payment/error`,
      Ds_Merchant_ConsumerLanguage: '001',
      Ds_Merchant_ProductDescription: `Pedido ${order.public_order_code}`,
      Ds_Merchant_MerchantName: 'Castanya de Viladrau',
    };

    const signingKey = process.env.REDSYS_SECRET_KEY_DEV || SECRET_KEY;
    const signature = generateSignature(parameters, signingKey);
    const parametersBase64 = Buffer.from(JSON.stringify(parameters)).toString('base64');
    const updatedOrder = await updateSupabaseOrder(order.id, {
      status: 'pending_payment',
      payment_status: 'pending',
      payment_reference: merchantOrderCode,
      payment_raw_response: {
        initiated_at: new Date().toISOString(),
        merchant_order_code: merchantOrderCode,
        redsys_url: REDSYS_URL,
      },
    });

    return jsonResponse(200, {
      success: true,
      payment: {
        redsysUrl: isMockProvider ? `${SITE_URL}/.netlify/functions/redsys-mock` : REDSYS_URL,
        parameters: parametersBase64,
        signature,
        signatureVersion: 'HMAC_SHA256_V1',
      },
      order: {
        id: order.id,
        publicOrderCode: order.public_order_code,
        paymentReference: updatedOrder ? updatedOrder.payment_reference : merchantOrderCode,
        totalAmount,
        currency: order.currency,
        status: updatedOrder ? updatedOrder.status : order.status,
        paymentStatus: updatedOrder ? updatedOrder.payment_status : order.payment_status,
      },
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    return jsonResponse(500, {
      error: 'Payment processing failed',
      details: error.message,
    });
  }
};
