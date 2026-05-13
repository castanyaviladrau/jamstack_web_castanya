const test = require('node:test');
const assert = require('node:assert/strict');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('newsletter-subscribe handler returns 405 for non-POST requests', async () => {
  const mod = freshRequire('../netlify/functions/newsletter-subscribe.js');

  const response = await mod.handler({
    httpMethod: 'GET',
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'Method not allowed' });
});

test('newsletter-subscribe handler returns 400 for invalid email', async () => {
  const mod = freshRequire('../netlify/functions/newsletter-subscribe.js');

  const response = await mod.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ email: 'not-an-email' }),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'Invalid email format' });
});

test('newsletter-subscribe handler sends newsletter email through Brevo', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';
  process.env.FROM_NAME = 'Castanya de Viladrau';
  process.env.URL = 'https://example.com';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url) === 'https://api.brevo.com/v3/smtp/email') {
      return {
        ok: true,
        json: async () => ({ messageId: 'newsletter-message' }),
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire('../netlify/functions/newsletter-subscribe.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'client@example.com' }),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      message: 'Successfully subscribed to newsletter',
    });
    assert.equal(fetchCalls.length, 1);

    const payload = JSON.parse(fetchCalls[0].options.body);
    assert.equal(payload.to[0].email, 'client@example.com');
    assert.equal(payload.sender.email, 'no-reply@example.com');
    assert.equal(payload.subject, 'Bienvenido a nuestro newsletter');
  } finally {
    global.fetch = originalFetch;
  }
});

test('newsletter-subscribe handler returns 500 when Brevo is not configured', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.BREVO_API_KEY = '';
  process.env.FROM_EMAIL = '';

  const mod = freshRequire('../netlify/functions/newsletter-subscribe.js');
  const response = await mod.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ email: 'client@example.com' }),
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: 'Failed to subscribe to newsletter',
  });
});

test('newsletter-subscribe handler succeeds without sending when EMAIL_SENDING_ENABLED is false', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'false';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';

  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  try {
    const mod = freshRequire('../netlify/functions/newsletter-subscribe.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'client@example.com' }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalled, false);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      message: 'Successfully subscribed to newsletter',
    });
  } finally {
    global.fetch = originalFetch;
  }
});
