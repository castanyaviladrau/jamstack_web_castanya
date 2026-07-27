require('dotenv').config();
const { sendEmail, isBrevoConfigured } = require('./send-email');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.URL;

const REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
const AUTO_CANCEL_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
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

async function fetchPendingOrdersOlderThan(cutoffIso, extraFilter = '') {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*&status=eq.pending_payment&created_at=lt.${encodeURIComponent(cutoffIso)}${extraFilter}`,
    {
      headers: getSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase pending orders lookup failed: ${errorText}`);
  }

  return response.json();
}

async function updateOrder(orderId, payload) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: getSupabaseHeaders(),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase order update failed: ${errorText}`);
  }
}

function buildResumeUrl(order) {
  return `${SITE_URL}/shop/cart/?resume=${encodeURIComponent(order.public_order_code)}`;
}

async function sendReminders(now) {
  const cutoff = new Date(now.getTime() - REMINDER_DELAY_MS).toISOString();
  const orders = await fetchPendingOrdersOlderThan(
    cutoff,
    '&payment_reminder_sent_at=is.null',
  );

  let remindersSent = 0;
  for (const order of orders) {
    if (isBrevoConfigured() && order.customer_email) {
      await sendEmail({
        type: 'payment-reminder',
        to: order.customer_email,
        data: {
          orderCode: order.public_order_code,
          totalAmount: order.total_amount,
          resumeUrl: buildResumeUrl(order),
        },
      });
    }

    await updateOrder(order.id, { payment_reminder_sent_at: now.toISOString() });
    remindersSent += 1;
  }

  return remindersSent;
}

async function cancelStaleOrders(now) {
  const cutoff = new Date(now.getTime() - AUTO_CANCEL_DELAY_MS).toISOString();
  const orders = await fetchPendingOrdersOlderThan(cutoff);

  let ordersCancelled = 0;
  for (const order of orders) {
    await updateOrder(order.id, { status: 'cancelled' });
    ordersCancelled += 1;
  }

  return ordersCancelled;
}

exports._test = {
  buildResumeUrl,
  REMINDER_DELAY_MS,
  AUTO_CANCEL_DELAY_MS,
};

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Supabase environment is not configured' });
  }

  const now = new Date();

  try {
    const remindersSent = await sendReminders(now);
    const ordersCancelled = await cancelStaleOrders(now);

    return jsonResponse(200, { success: true, remindersSent, ordersCancelled });
  } catch (error) {
    console.error('payment-reminder error:', error);
    return jsonResponse(500, { success: false, error: error.message });
  }
};
