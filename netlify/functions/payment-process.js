const {
  createSignature,
  encodeMerchantParameters,
  getOrderValue,
} = require('./redsys-signature');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE;
const SECRET_KEY = process.env.REDSYS_SECRET_KEY;
const REDSYS_URL = process.env.REDSYS_URL || 'https://sis-t.redsys.es:25443/sis/realizarPago';
const SITE_URL = process.env.URL;
const TERMINAL = '001';
const CURRENCY = '978'; // EUR
const SIGNATURE_VERSION = 'HMAC_SHA512_V2';

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

function shouldRefreshMerchantOrderCode(order) {
  const callbackResponseCode = order?.payment_raw_response?.callback_response_code;
  return order?.payment_status === 'failed' || callbackResponseCode != null;
}

function resolveMerchantOrderCode(order) {
  if (!order?.payment_reference || shouldRefreshMerchantOrderCode(order)) {
    return createMerchantOrderCode(order);
  }

  return order.payment_reference;
}

function normalizePaymentMethod() {
  return 'card';
}

function buildMerchantParameters({
  amountInCents,
  merchantOrderCode,
  order,
}) {
  return {
    DS_MERCHANT_AMOUNT: amountInCents.toString(),
    DS_MERCHANT_ORDER: merchantOrderCode,
    DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE || 'MOCK',
    DS_MERCHANT_CURRENCY: CURRENCY,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL: TERMINAL,
    DS_MERCHANT_MERCHANTURL: `${SITE_URL}/.netlify/functions/payment-callback`,
    DS_MERCHANT_URLOK: `${SITE_URL}/payment/success`,
    DS_MERCHANT_URLKO: `${SITE_URL}/payment/error`,
    DS_MERCHANT_CONSUMERLANGUAGE: '001',
    DS_MERCHANT_PRODUCTDESCRIPTION: `Pedido ${order.public_order_code}`,
    DS_MERCHANT_MERCHANTNAME: 'Castanya de Viladrau',
  };
}

function generateSignature(parameters, key) {
  const order = getOrderValue(parameters);

  if (!order) {
    throw new Error('Missing DS_MERCHANT_ORDER for RedSys signature generation');
  }

  const merchantParameters = encodeMerchantParameters(parameters);
  return createSignature(merchantParameters, order, key);
}

exports._test = {
  buildMerchantParameters,
  createMerchantOrderCode,
  generateSignature,
  normalizePaymentMethod,
  resolveMerchantOrderCode,
  shouldRefreshMerchantOrderCode,
};

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

  if (!SITE_URL) {
    return jsonResponse(503, {
      error: 'Payment provider not configured',
      details: 'Missing site URL environment variables',
    });
  }

  if (!MERCHANT_CODE || !SECRET_KEY) {
    return jsonResponse(503, {
      error: 'Payment provider not configured',
      details: 'Missing RedSys merchant environment variables',
    });
  }

  try {
    const { orderId, publicOrderCode, paymentMethod } = JSON.parse(event.body || '{}');
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
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

    const merchantOrderCode = resolveMerchantOrderCode(order);
    const parameters = buildMerchantParameters({
      amountInCents,
      merchantOrderCode,
      order,
    });

    const parametersBase64Url = encodeMerchantParameters(parameters);
    const signature = createSignature(parametersBase64Url, merchantOrderCode, SECRET_KEY);
    const updatedOrder = await updateSupabaseOrder(order.id, {
      status: 'pending_payment',
      payment_status: 'pending',
      payment_reference: merchantOrderCode,
      payment_raw_response: {
        initiated_at: new Date().toISOString(),
        merchant_order_code: merchantOrderCode,
        redsys_url: REDSYS_URL,
        payment_method: normalizedPaymentMethod,
        signature_version: SIGNATURE_VERSION,
      },
    });

    return jsonResponse(200, {
      success: true,
      payment: {
        redsysUrl: REDSYS_URL,
        parameters: parametersBase64Url,
        signature,
        signatureVersion: SIGNATURE_VERSION,
      },
      order: {
        id: order.id,
        publicOrderCode: order.public_order_code,
        paymentReference: updatedOrder ? updatedOrder.payment_reference : merchantOrderCode,
        totalAmount,
        currency: order.currency,
        status: updatedOrder ? updatedOrder.status : order.status,
        paymentStatus: updatedOrder ? updatedOrder.payment_status : order.payment_status,
        paymentMethod: normalizedPaymentMethod,
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
