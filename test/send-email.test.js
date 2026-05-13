const test = require('node:test');
const assert = require('node:assert/strict');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('send-email handler returns 503 when Brevo is not configured', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.BREVO_API_KEY = '';
  process.env.FROM_EMAIL = '';

  const mod = freshRequire('../netlify/functions/send-email.js');
  const response = await mod.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ type: 'contact', data: { name: 'Test' } }),
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: 'Failed to send email',
    details: 'Brevo environment is not configured',
  });
});

test('send-email handler returns 500 when contact recipient is missing', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';
  process.env.CONTACT_EMAIL = '';

  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  try {
    const mod = freshRequire('../netlify/functions/send-email.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        type: 'contact',
        data: {
          name: 'Test',
          email: 'client@example.com',
          phone: '123456789',
          message: 'Hello',
        },
      }),
    });

    assert.equal(response.statusCode, 500);
    assert.equal(fetchCalled, false);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: 'Failed to send email',
      details: 'Contact email is not configured',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('send-email handler sends contact email when configured', async () => {
  process.env.EMAIL_SENDING_ENABLED = 'true';
  process.env.BREVO_API_KEY = 'brevo-key';
  process.env.FROM_EMAIL = 'no-reply@example.com';
  process.env.FROM_NAME = 'Castanya de Viladrau';
  process.env.CONTACT_EMAIL = 'info@example.com';

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    return {
      ok: true,
      json: async () => ({ messageId: 'contact-message' }),
    };
  };

  try {
    const mod = freshRequire('../netlify/functions/send-email.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        type: 'contact',
        data: {
          name: 'Test',
          email: 'client@example.com',
          phone: '123456789',
          message: 'Hello',
        },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalls.length, 1);

    const payload = JSON.parse(fetchCalls[0].options.body);
    assert.equal(payload.to[0].email, 'info@example.com');
    assert.equal(payload.sender.email, 'no-reply@example.com');
    assert.equal(payload.subject, 'Nuevo mensaje de contacto de Test');
  } finally {
    global.fetch = originalFetch;
  }
});

test('send-email handler skips sending when EMAIL_SENDING_ENABLED is false', async () => {
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
    const mod = freshRequire('../netlify/functions/send-email.js');
    const response = await mod.handler({
      httpMethod: 'POST',
      body: JSON.stringify({ type: 'contact', data: { name: 'Test' } }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fetchCalled, false);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      message: 'Email sending skipped',
      skipped: true,
      reason: 'disabled_by_env',
    });
  } finally {
    global.fetch = originalFetch;
  }
});
