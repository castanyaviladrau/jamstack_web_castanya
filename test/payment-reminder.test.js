const test = require('node:test');
const assert = require('node:assert/strict');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('payment-reminder._test.buildResumeUrl links back to the cart with the order code', () => {
  process.env.URL = 'https://example.com';
  const mod = freshRequire('../netlify/functions/payment-reminder.js');

  const url = mod._test.buildResumeUrl({ public_order_code: 'CV-12345678-ABCD' });
  assert.equal(url, 'https://example.com/shop/cart/?resume=CV-12345678-ABCD');
});

test('payment-reminder._test exposes 24h reminder delay and 7 day auto-cancel delay', () => {
  const mod = freshRequire('../netlify/functions/payment-reminder.js');

  assert.equal(mod._test.REMINDER_DELAY_MS, 24 * 60 * 60 * 1000);
  assert.equal(mod._test.AUTO_CANCEL_DELAY_MS, 7 * 24 * 60 * 60 * 1000);
});

test('payment-reminder handler returns 500 when Supabase env is missing', async () => {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';

  const mod = freshRequire('../netlify/functions/payment-reminder.js');
  const response = await mod.handler();

  assert.equal(response.statusCode, 500);
});

test('payment-reminder handler emails and flags stale pending orders, cancels very old ones', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.URL = 'https://example.com';
  process.env.BREVO_API_KEY = '';
  process.env.FROM_EMAIL = '';

  const originalFetch = global.fetch;
  const fetchCalls = [];

  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });

    if (String(url).includes('payment_reminder_sent_at=is.null')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-reminder',
            public_order_code: 'CV-REMIND-1',
            total_amount: 24.9,
            customer_email: 'customer@example.com',
          },
        ],
      };
    }

    if (
      String(url).includes('/rest/v1/orders?select=') &&
      options.method !== 'PATCH'
    ) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'order-stale',
            public_order_code: 'CV-STALE-1',
            total_amount: 12.5,
            customer_email: 'stale@example.com',
          },
        ],
      };
    }

    if (options.method === 'PATCH') {
      return { ok: true, json: async () => [] };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/payment-reminder.js');
    const response = await mod.handler();
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.remindersSent, 1);
    assert.equal(payload.ordersCancelled, 1);

    const reminderPatch = fetchCalls.find(
      ({ url, options: callOptions }) =>
        callOptions.method === 'PATCH' && url.includes('id=eq.order-reminder'),
    );
    assert.ok(reminderPatch);
    const reminderBody = JSON.parse(reminderPatch.options.body);
    assert.ok(reminderBody.payment_reminder_sent_at);

    const cancelPatch = fetchCalls.find(
      ({ url, options: callOptions }) =>
        callOptions.method === 'PATCH' && url.includes('id=eq.order-stale'),
    );
    assert.ok(cancelPatch);
    const cancelBody = JSON.parse(cancelPatch.options.body);
    assert.equal(cancelBody.status, 'cancelled');
  } finally {
    global.fetch = originalFetch;
  }
});
