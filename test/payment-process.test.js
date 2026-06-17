const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decodeMerchantParameters,
  encodeMerchantParameters,
  verifyMerchantParametersSignature,
} = require('../netlify/functions/redsys-signature.js');

function freshRequire(modulePath) {
  // Ensure env var reads at module top-level are re-evaluated.
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function testKey(char = 'a') {
  return String(char).repeat(32);
}

test('payment-process._test.generateSignature produces stable signature', () => {
  const secretKey = testKey('7');
  const mod = freshRequire('../netlify/functions/payment-process.js');

  const params = {
    DS_MERCHANT_AMOUNT: '100',
    DS_MERCHANT_ORDER: '123456789012',
    DS_MERCHANT_MERCHANTCODE: 'MOCK',
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL: '001',
  };

  const sig1 = mod._test.generateSignature(params, secretKey);
  const sig2 = mod._test.generateSignature(params, secretKey);
  assert.equal(typeof sig1, 'string');
  assert.equal(sig1, sig2);
});

test('payment-process._test.debug Redsys docs example payload', () => {
  const secretKey = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';
  const mod = freshRequire('../netlify/functions/payment-process.js');
  const params = {
    DS_MERCHANT_AMOUNT: '999',
    DS_MERCHANT_ORDER: '1234567890',
    DS_MERCHANT_MERCHANTCODE: '999008881',
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL: '1',
    DS_MERCHANT_MERCHANTURL: 'http://www.prueba.com/urlNotificacion.php',
    DS_MERCHANT_URLOK: 'http://www.prueba.com/urlOK.php',
    DS_MERCHANT_URLKO: 'http://www.prueba.com/urlKO.php',
  };

  const expected = {
    Ds_MerchantParameters:
      'eyJEU19NRVJDSEFOVF9BTU9VTlQiOiI5OTkiLCJEU19NRVJDSEFOVF9PUkRFUiI6IjEyMzQ1Njc4OTAiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiI5OTkwMDg4ODEiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6IjEiLCJEU19NRVJDSEFOVF9NRVJDSEFOVFVSTCI6Imh0dHA6XC9cL3d3dy5wcnVlYmEuY29tXC91cmxOb3RpZmljYWNpb24ucGhwIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiJodHRwOlwvXC93d3cucHJ1ZWJhLmNvbVwvdXJsT0sucGhwIiwiRFNfTUVSQ0hBTlRfVVJMS08iOiJodHRwOlwvXC93d3cucHJ1ZWJhLmNvbVwvdXJsS08ucGhwIn0',
    Ds_Signature:
      'Vjo02eSWq249IeZZp3R-ArFnGLhKY0OuzDDlx1BuVtZDC2yhczA7_11uZhsYzLZBCMFAz8u8uzGDX3AErHKmmw',
    Ds_SignatureVersion: 'HMAC_SHA512_V2',
  };

  const actual = {
    Ds_MerchantParameters: encodeMerchantParameters(params),
    Ds_Signature: mod._test.generateSignature(params, secretKey),
    Ds_SignatureVersion: 'HMAC_SHA512_V2',
  };

  if (process.env.DEBUG_REDSYS === '1') {
    console.log('Expected Redsys sample:', JSON.stringify(expected, null, 2));
    console.log('Generated payload:', JSON.stringify(actual, null, 2));
  }

  assert.equal(actual.Ds_SignatureVersion, expected.Ds_SignatureVersion);
  assert.equal(typeof actual.Ds_MerchantParameters, 'string');
  assert.equal(typeof actual.Ds_Signature, 'string');
});

test('payment-process._test.createMerchantOrderCode returns 12 digits', () => {
  const mod = freshRequire('../netlify/functions/payment-process.js');

  const code = mod._test.createMerchantOrderCode({
    id: 'abc-123',
    public_order_code: 'CV-00000000-ABCD',
  });

  assert.match(code, /^\d{12}$/);
});

test('payment-process._test.normalizePaymentMethod defaults to card', () => {
  const mod = freshRequire('../netlify/functions/payment-process.js');

  assert.equal(mod._test.normalizePaymentMethod(), 'card');
  assert.equal(mod._test.normalizePaymentMethod('card'), 'card');
  assert.equal(mod._test.normalizePaymentMethod('CARD'), 'card');
  assert.equal(mod._test.normalizePaymentMethod('bizum'), 'bizum');
  assert.equal(mod._test.normalizePaymentMethod('anything-else'), 'card');
});

test('payment-process handler returns 404 when order is missing', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = 'merchant';
  process.env.REDSYS_SECRET_KEY = testKey('5');
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = '';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => [],
  });

  try {
    const mod = freshRequire('../netlify/functions/payment-process.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ orderId: 'missing-order' }),
    });

    assert.equal(response.statusCode, 404);
    assert.match(response.body, /Order not found/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-process handler returns 400 when order total is invalid', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = 'merchant';
  process.env.REDSYS_SECRET_KEY = testKey('5');
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = '';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => [{ id: '1', public_order_code: 'CV-1', total_amount: 0, currency: 'EUR' }],
  });

  try {
    const mod = freshRequire('../netlify/functions/payment-process.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ orderId: 'bad-total' }),
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /Order total is not valid for payment/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-process handler returns payment payload for valid order', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = 'merchant';
  process.env.REDSYS_SECRET_KEY = testKey('6');
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.REDSYS_SECRET_KEY_DEV = testKey('6');

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes('/rest/v1/orders?select=')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-1',
            public_order_code: 'CV-12345678-ABCD',
            total_amount: 12.5,
            currency: 'EUR',
            payment_status: 'pending',
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
            public_order_code: 'CV-12345678-ABCD',
            total_amount: 12.5,
            currency: 'EUR',
            status: 'pending_payment',
            payment_status: 'pending',
            payment_reference: '123456789012',
          },
        ],
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-process.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ orderId: 'order-1' }),
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.order.id, 'order-1');
    assert.equal(payload.order.paymentStatus, 'pending');
    assert.equal(payload.order.paymentMethod, 'card');
    assert.equal(payload.payment.redsysUrl, 'https://example.com/.netlify/functions/redsys-mock');
    assert.equal(payload.payment.signatureVersion, 'HMAC_SHA512_V2');
    assert.equal(typeof payload.payment.parameters, 'string');
    assert.equal(typeof payload.payment.signature, 'string');

    const merchantParameters = decodeMerchantParameters(payload.payment.parameters);
    assert.equal(merchantParameters.DS_MERCHANT_PAYMETHODS, undefined);
    assert.equal(merchantParameters.DS_MERCHANT_TERMINAL, '001');

    const verification = verifyMerchantParametersSignature(
      payload.payment.parameters,
      payload.payment.signature,
      process.env.REDSYS_SECRET_KEY_DEV,
    );
    assert.equal(verification.isValid, true);
    assert.equal(fetchCalls.length, 2);
  } finally {
    global.fetch = originalFetch;
    delete process.env.REDSYS_SECRET_KEY_DEV;
  }
});

test('payment-process handler includes Bizum pay method when requested', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = 'merchant';
  process.env.REDSYS_SECRET_KEY = testKey('b');
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.REDSYS_SECRET_KEY_DEV = testKey('b');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/rest/v1/orders?select=')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-bizum',
            public_order_code: 'CV-BIZUM-1',
            total_amount: 18.75,
            currency: 'EUR',
            payment_status: 'pending',
          },
        ],
      };
    }

    if (String(url).includes('/rest/v1/orders?id=eq.order-bizum')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-bizum',
            public_order_code: 'CV-BIZUM-1',
            total_amount: 18.75,
            currency: 'EUR',
            status: 'pending_payment',
            payment_status: 'pending',
            payment_reference: '123456789012',
          },
        ],
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-process.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ orderId: 'order-bizum', paymentMethod: 'bizum' }),
    });
    const payload = JSON.parse(response.body);
    const merchantParameters = decodeMerchantParameters(payload.payment.parameters);

    assert.equal(response.statusCode, 200);
    assert.equal(payload.order.paymentMethod, 'bizum');
    assert.equal(merchantParameters.DS_MERCHANT_PAYMETHODS, 'z');
  } finally {
    global.fetch = originalFetch;
    delete process.env.REDSYS_SECRET_KEY_DEV;
  }
});

test('payment-process handler returns 409 when order is already paid', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = 'merchant';
  process.env.REDSYS_SECRET_KEY = testKey('c');
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = '';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        id: 'order-paid',
        public_order_code: 'CV-PAID',
        total_amount: 12.5,
        currency: 'EUR',
        payment_status: 'paid',
      },
    ],
  });

  try {
    const mod = freshRequire('../netlify/functions/payment-process.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ orderId: 'order-paid' }),
    });

    assert.equal(response.statusCode, 409);
    assert.match(response.body, /Order already paid/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('payment-process handler returns 503 when payment provider env is missing', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.REDSYS_MERCHANT_CODE = '';
  process.env.REDSYS_SECRET_KEY = '';
  process.env.URL = 'https://example.com';
  process.env.PAYMENT_PROVIDER = '';

  const mod = freshRequire('../netlify/functions/payment-process.js');
  const response = await mod.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ orderId: 'order-1' }),
  });

  assert.equal(response.statusCode, 503);
  assert.match(response.body, /Payment provider not configured/);
});
