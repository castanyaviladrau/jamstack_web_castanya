const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function encryptOrder(order, secretKeyBase64) {
  const keyBytes = Buffer.from(secretKeyBase64, 'base64');
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv('des-ede3-cbc', keyBytes, iv);
  return Buffer.concat([cipher.update(order, 'utf8'), cipher.final()]).toString('base64');
}

function signMerchantParameters(merchantParametersBase64, order, secretKeyBase64) {
  const encrypted = encryptOrder(order, secretKeyBase64);
  const hmac = crypto.createHmac('sha256', Buffer.from(encrypted, 'base64'));
  hmac.update(merchantParametersBase64);
  return hmac.digest('base64');
}

test('payment-callback._test.verifySignature accepts valid signature', () => {
  const secretKey = Buffer.alloc(24, 3).toString('base64');
  const mod = freshRequire('../netlify/functions/payment-callback.js');

  const payload = { Ds_Order: '123456789012', Ds_Response: '0000' };
  const merchantParameters = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const signature = signMerchantParameters(merchantParameters, payload.Ds_Order, secretKey);

  const result = mod._test.verifySignature(merchantParameters, signature, secretKey);
  assert.equal(result.isValid, true);
  assert.equal(result.parameters.Ds_Response, '0000');
});

test('payment-callback._test.verifySignature rejects invalid signature', () => {
  const secretKey = Buffer.alloc(24, 4).toString('base64');
  const mod = freshRequire('../netlify/functions/payment-callback.js');

  const payload = { Ds_Order: '123456789012', Ds_Response: '0000' };
  const merchantParameters = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

  const result = mod._test.verifySignature(merchantParameters, 'not-a-real-signature', secretKey);
  assert.equal(result.isValid, false);
});

test('payment-callback._test.parseEventBody parses urlencoded', () => {
  const mod = freshRequire('../netlify/functions/payment-callback.js');

  const body = mod._test.parseEventBody({
    body: 'a=1&b=hello',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

  assert.equal(body.a, '1');
  assert.equal(body.b, 'hello');
});

test('payment-callback._test.mergePaymentSnapshot merges objects', () => {
  const mod = freshRequire('../netlify/functions/payment-callback.js');

  const merged = mod._test.mergePaymentSnapshot(
    { initiated_at: 't1', keep: true },
    { callback_received_at: 't2', keep: false },
  );

  assert.deepEqual(merged, {
    initiated_at: 't1',
    keep: false,
    callback_received_at: 't2',
  });
});

test('payment-callback handler returns 400 for invalid signature', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 8).toString('base64');
  process.env.PAYMENT_PROVIDER = '';

  const mod = freshRequire('../netlify/functions/payment-callback.js');
  const payload = Buffer.from(JSON.stringify({ Ds_Order: '123456789012', Ds_Response: '0000' }), 'utf8').toString('base64');

  const response = await mod.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `Ds_MerchantParameters=${encodeURIComponent(payload)}&Ds_Signature=bad-signature`,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body, 'Invalid signature');
});

test('payment-callback handler marks order as paid on successful response', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 9).toString('base64');
  process.env.PAYMENT_PROVIDER = '';
  process.env.BREVO_API_KEY = '';
  process.env.FROM_EMAIL = '';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes('payment_reference=eq.123456789012')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-1',
            public_order_code: 'CV-PAID-1',
            payment_status: 'pending',
            payment_raw_response: { initiated_at: '2026-01-01T00:00:00.000Z' },
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            shipping_address_json: {},
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/orders?id=eq.order-1')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-1',
            public_order_code: 'CV-PAID-1',
            payment_status: 'paid',
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            shipping_address_json: {},
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/order_items?select=*&order_id=eq.order-1')) {
      return {
        ok: true,
        json: async () => [],
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-callback.js');
    const callbackPayload = { Ds_Order: '123456789012', Ds_Response: '0000' };
    const merchantParameters = Buffer.from(JSON.stringify(callbackPayload), 'utf8').toString('base64');
    const signature = signMerchantParameters(
      merchantParameters,
      callbackPayload.Ds_Order,
      process.env.REDSYS_SECRET_KEY,
    );

    const response = await mod.handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `Ds_MerchantParameters=${encodeURIComponent(merchantParameters)}&Ds_Signature=${encodeURIComponent(signature)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'OK');
    assert.equal(fetchCalls.length, 2);

    const updateCall = fetchCalls[1];
    const updatePayload = JSON.parse(updateCall.options.body);
    assert.equal(updatePayload.payment_status, 'paid');
    assert.equal(updatePayload.status, 'processed');
    assert.equal(updatePayload.fulfillment_status, 'delivered');
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-callback handler marks order as failed on unsuccessful response', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 10).toString('base64');
  process.env.PAYMENT_PROVIDER = '';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes('payment_reference=eq.123456789012')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-2',
            public_order_code: 'CV-FAILED-1',
            payment_status: 'pending',
            payment_raw_response: { initiated_at: '2026-01-01T00:00:00.000Z' },
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/orders?id=eq.order-2')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-2',
            public_order_code: 'CV-FAILED-1',
            payment_status: 'failed',
          },
        ],
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-callback.js');
    const callbackPayload = { Ds_Order: '123456789012', Ds_Response: '0101' };
    const merchantParameters = Buffer.from(JSON.stringify(callbackPayload), 'utf8').toString('base64');
    const signature = signMerchantParameters(
      merchantParameters,
      callbackPayload.Ds_Order,
      process.env.REDSYS_SECRET_KEY,
    );

    const response = await mod.handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `Ds_MerchantParameters=${encodeURIComponent(merchantParameters)}&Ds_Signature=${encodeURIComponent(signature)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'Payment failed');

    const updateCall = fetchCalls[1];
    const updatePayload = JSON.parse(updateCall.options.body);
    assert.equal(updatePayload.payment_status, 'failed');
    assert.equal(updatePayload.status, 'pending_payment');
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-callback handler returns 400 when callback payload is missing', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 12).toString('base64');
  process.env.PAYMENT_PROVIDER = '';

  const mod = freshRequire('../netlify/functions/payment-callback.js');
  const response = await mod.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: '',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body, 'Missing callback payload');
});

test('payment-callback handler returns 503 when secret key is missing', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = '';
  process.env.REDSYS_SECRET_KEY_DEV = '';
  process.env.PAYMENT_PROVIDER = '';

  const mod = freshRequire('../netlify/functions/payment-callback.js');
  const response = await mod.handler({
    httpMethod: 'POST',
    body: '{}',
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body, 'Payment provider not configured');
});

test('payment-callback handler is idempotent when order is already paid', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 13).toString('base64');
  process.env.PAYMENT_PROVIDER = '';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url) => {
    fetchCalls.push({ url });

    if (String(url).includes('payment_reference=eq.123456789012')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-paid',
            public_order_code: 'CV-PAID-IDEMPOTENT',
            payment_status: 'paid',
            payment_raw_response: { initiated_at: '2026-01-01T00:00:00.000Z' },
          },
        ],
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-callback.js');
    const callbackPayload = { Ds_Order: '123456789012', Ds_Response: '0000' };
    const merchantParameters = Buffer.from(JSON.stringify(callbackPayload), 'utf8').toString('base64');
    const signature = signMerchantParameters(
      merchantParameters,
      callbackPayload.Ds_Order,
      process.env.REDSYS_SECRET_KEY,
    );

    const response = await mod.handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `Ds_MerchantParameters=${encodeURIComponent(merchantParameters)}&Ds_Signature=${encodeURIComponent(signature)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'OK');
    assert.equal(fetchCalls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-callback handler sends customer and provider emails when Brevo is configured', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 14).toString('base64');
  process.env.PAYMENT_PROVIDER = '';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';
  process.env.ORDER_NOTIFICATION_EMAIL = 'orders@example.com';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes('payment_reference=eq.123456789012')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-3',
            public_order_code: 'CV-PAID-EMAILS',
            payment_status: 'pending',
            payment_raw_response: { initiated_at: '2026-01-01T00:00:00.000Z' },
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            customer_phone: '+34123456789',
            notes: 'Leave at the door',
            shipping_address_json: {
              address_line_1: 'Street 1',
              city: 'Vic',
              postal_code: '08500',
              country: 'ES',
            },
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/orders?id=eq.order-3')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-3',
            public_order_code: 'CV-PAID-EMAILS',
            payment_status: 'paid',
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            customer_phone: '+34123456789',
            notes: 'Leave at the door',
            shipping_address_json: {
              address_line_1: 'Street 1',
              city: 'Vic',
              postal_code: '08500',
              country: 'ES',
            },
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/order_items?select=*&order_id=eq.order-3')) {
      return {
        ok: true,
        json: async () => [
          {
            product_name: 'Castanya',
            variant_label: '1kg',
            quantity: 2,
            line_total: 15,
          },
        ],
      };
    }

    if (String(url) === 'https://api.brevo.com/v3/smtp/email') {
      return {
        ok: true,
        json: async () => ({ messageId: 'brevo-message' }),
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-callback.js');
    const callbackPayload = { Ds_Order: '123456789012', Ds_Response: '0000' };
    const merchantParameters = Buffer.from(JSON.stringify(callbackPayload), 'utf8').toString('base64');
    const signature = signMerchantParameters(
      merchantParameters,
      callbackPayload.Ds_Order,
      process.env.REDSYS_SECRET_KEY,
    );

    const response = await mod.handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `Ds_MerchantParameters=${encodeURIComponent(merchantParameters)}&Ds_Signature=${encodeURIComponent(signature)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'OK');

    const brevoCalls = fetchCalls.filter((call) => String(call.url) === 'https://api.brevo.com/v3/smtp/email');
    assert.equal(brevoCalls.length, 2);

    const customerEmailPayload = JSON.parse(brevoCalls[0].options.body);
    const providerEmailPayload = JSON.parse(brevoCalls[1].options.body);
    assert.equal(customerEmailPayload.to[0].email, 'buyer@example.com');
    assert.equal(providerEmailPayload.to[0].email, 'orders@example.com');
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-callback handler skips order emails when EMAIL_SENDING_ENABLED is false', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'false';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_SECRET_KEY = Buffer.alloc(24, 15).toString('base64');
  process.env.PAYMENT_PROVIDER = '';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';
  process.env.ORDER_NOTIFICATION_EMAIL = 'orders@example.com';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes('payment_reference=eq.123456789012')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-4',
            public_order_code: 'CV-PAID-NO-EMAILS',
            payment_status: 'pending',
            payment_raw_response: { initiated_at: '2026-01-01T00:00:00.000Z' },
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            shipping_address_json: {},
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/orders?id=eq.order-4')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-4',
            public_order_code: 'CV-PAID-NO-EMAILS',
            payment_status: 'paid',
            customer_email: 'buyer@example.com',
            customer_name: 'Buyer',
            shipping_address_json: {},
          },
        ],
      };
    }

    if (String(url) === 'https://api.brevo.com/v3/smtp/email') {
      throw new Error('Brevo should not be called when email sending is disabled');
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-callback.js');
    const callbackPayload = { Ds_Order: '123456789012', Ds_Response: '0000' };
    const merchantParameters = Buffer.from(JSON.stringify(callbackPayload), 'utf8').toString('base64');
    const signature = signMerchantParameters(
      merchantParameters,
      callbackPayload.Ds_Order,
      process.env.REDSYS_SECRET_KEY,
    );

    const response = await mod.handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `Ds_MerchantParameters=${encodeURIComponent(merchantParameters)}&Ds_Signature=${encodeURIComponent(signature)}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'OK');
    assert.equal(fetchCalls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
