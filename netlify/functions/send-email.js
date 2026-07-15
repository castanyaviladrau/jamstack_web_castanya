const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function isBrevoConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.FROM_EMAIL);
}

function getSender() {
  return {
    email: process.env.FROM_EMAIL,
    name: process.env.FROM_NAME || "Castanya de Viladrau",
  };
}

function getRequiredRecipient(type, to) {
  switch (type) {
    case "contact":
    case "activity-booking-notification":
      return process.env.CONTACT_EMAIL;
    case "order-confirmation":
    case "newsletter":
    case "activity-booking-confirmation":
      return to;
    case "order-notification":
      return process.env.ORDER_NOTIFICATION_EMAIL;
    default:
      return undefined;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function withEmailContent(emailConfig) {
  const htmlContent = String(
    emailConfig.htmlContent || emailConfig.html || "",
  ).trim();
  const textContent = String(emailConfig.textContent || "").trim();

  return {
    ...emailConfig,
    htmlContent:
      htmlContent ||
      "<p>Hem rebut la teva solicitud correctament. Si us plau, contacta amb nosaltres si necessites ajuda addicional.</p>",
    textContent:
      textContent ||
      "Hem rebut la teva solicitud correctament. Si us plau, contacta amb nosaltres si necessites ajuda addicional.",
  };
}

function buildOrderConfirmationEmail({ to, data }) {
  const orderTotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const isPickup = data.customer.fulfillmentMethod === "pickup";
  const itemsList = data.items
    .map(
      (item) =>
        `<li>${escapeHtml(item.name)} (${escapeHtml(item.variantLabel)}) x${item.quantity} - € ${item.lineTotal.toFixed(2)}</li>`,
    )
    .join("");

  const billingBlock = data.billing
    ? `
      <h3>Dades de facturació</h3>
      <p>
        ${data.billing.company ? `${escapeHtml(data.billing.company)}<br>` : ""}
        ${data.billing.vat ? `NIF/VAT: ${escapeHtml(data.billing.vat)}<br>` : ""}
        ${data.billing.address ? `${escapeHtml(data.billing.address)}<br>` : ""}
        ${data.billing.city || data.billing.postalCode ? `${escapeHtml(data.billing.city || "")}${data.billing.city && data.billing.postalCode ? ", " : ""}${escapeHtml(data.billing.postalCode || "")}<br>` : ""}
        ${data.billing.country ? `${escapeHtml(data.billing.country)}` : ""}
      </p>`
    : "";

  const fulfillmentBlock = isPickup
    ? `
      <h3>Recollida de la comanda</h3>
      <p>
        Has indicat que vindras a recollir la comanda a la botiga de
        <strong>${escapeHtml(data.customer.pickupStore)}</strong>.
      </p>`
    : `
      <h3>Dades d'enviament</h3>
      <p>
        ${escapeHtml(data.customer.name)}<br>
        ${escapeHtml(data.customer.address)}<br>
        ${escapeHtml(data.customer.city)}, ${escapeHtml(data.customer.postalCode)}<br>
        ${escapeHtml(data.customer.country)}
      </p>`;

  return {
    to: [{ email: to }],
    sender: getSender(),
    subject: `Confirmacion de pedido #${data.orderId}`,
    htmlContent: `
      <h2>Gracies per la teva comanda</h2>
      <p>Hem rebut correctament la comanda <strong>#${escapeHtml(data.orderId)}</strong>.</p>

      <h3>Detalls de la comanda</h3>
      <ul>${itemsList}</ul>

      <p><strong>Total: € ${orderTotal.toFixed(2)}</strong></p>

      ${fulfillmentBlock}
      ${billingBlock}

      <p>T'enviarem noves actualitzacions quan la comanda avanci.</p>
    `,
  };
}

function buildOrderNotificationEmail({ data }) {
  const orderTotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const isPickup = data.customer.fulfillmentMethod === "pickup";
  const itemsList = data.items
    .map(
      (item) =>
        `<li>${escapeHtml(item.name)} (${escapeHtml(item.variantLabel)}) x${item.quantity} - € ${item.lineTotal.toFixed(2)}</li>`,
    )
    .join("");

  const billingBlock = data.billing
    ? `
      <h3>Dades de facturació</h3>
      <p>
        ${data.billing.company ? `<strong>Empresa:</strong> ${escapeHtml(data.billing.company)}<br>` : ""}
        ${data.billing.vat ? `<strong>NIF/VAT:</strong> ${escapeHtml(data.billing.vat)}<br>` : ""}
        <strong>Adreça:</strong> ${escapeHtml(data.billing.address || "")}<br>
        ${escapeHtml(data.billing.city || "")}${data.billing.city && data.billing.postalCode ? ", " : ""}${escapeHtml(data.billing.postalCode || "")}<br>
        ${escapeHtml(data.billing.country || "")}
      </p>`
    : "";

  const fulfillmentBlock = isPickup
    ? `
      <h3>Recollida a botiga</h3>
      <p>
        <strong>Modalitat:</strong> Recollida a botiga<br>
        <strong>Botiga:</strong> ${escapeHtml(data.customer.pickupStore)}
      </p>`
    : `
      <h3>Adreca d'enviament</h3>
      <p>
        ${escapeHtml(data.customer.address)}<br>
        ${escapeHtml(data.customer.city)}, ${escapeHtml(data.customer.postalCode)}<br>
        ${escapeHtml(data.customer.country)}
      </p>`;

  return {
    to: [{ email: getRequiredRecipient("order-notification") }],
    sender: getSender(),
    subject: `Nou pedido pagat #${data.orderId}`,
    htmlContent: `
      <h2>Nou pedido pagat</h2>
      <p>S'ha confirmat el pagament de la comanda <strong>#${escapeHtml(data.orderId)}</strong>.</p>

      <h3>Dades del client</h3>
      <p>
        <strong>Nom:</strong> ${escapeHtml(data.customer.name)}<br>
        <strong>Email:</strong> ${escapeHtml(data.customer.email)}<br>
        <strong>Telefon:</strong> ${escapeHtml(data.customer.phone || "")}
      </p>

      ${fulfillmentBlock}
      ${billingBlock}

      <h3>Detalls de la comanda</h3>
      <ul>${itemsList}</ul>

      <p><strong>Total: € ${orderTotal.toFixed(2)}</strong></p>
      ${data.customer.notes ? `<p><strong>Notes:</strong> ${escapeHtml(data.customer.notes)}</p>` : ""}
    `,
  };
}

function buildContactEmail({ data }) {
  return {
    to: [{ email: getRequiredRecipient("contact") }],
    sender: getSender(),
    subject: `Nuevo mensaje de contacto de ${data.name}`,
    htmlContent: `
      <h2>Nuevo mensaje de contacto</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(data.phone || "No proporcionado")}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${escapeHtml(data.message)}</p>
    `,
  };
}

function buildActivityBookingNotificationEmail({ data }) {
  return {
    to: [{ email: getRequiredRecipient("activity-booking-notification") }],
    sender: getSender(),
    subject: `Nova solicitud de reserva: ${data.activityTitle}`,
    htmlContent: `
      <h2>Nova solicitud de reserva</h2>
      <p><strong>Activitat:</strong> ${escapeHtml(data.activityTitle)}</p>
      <p><strong>Enllac:</strong> <a href="${escapeHtml(data.activityUrl)}">${escapeHtml(data.activityUrl)}</a></p>
      <p><strong>Nom:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Telefon:</strong> ${escapeHtml(data.phone || "No proporcionat")}</p>
      <p><strong>Data preferida:</strong> ${escapeHtml(data.preferredDate)}</p>
      <p><strong>Nombre de persones:</strong> ${escapeHtml(data.partySize)}</p>
      <p><strong>Comentaris:</strong></p>
      <p>${escapeHtml(data.message || "Sense comentaris addicionals")}</p>
    `,
  };
}

function buildActivityBookingConfirmationEmail({ to, data }) {
  return {
    to: [{ email: getRequiredRecipient("activity-booking-confirmation", to) }],
    sender: getSender(),
    subject: `Hem rebut la teva solicitud: ${data.activityTitle}`,
    htmlContent: `
      <h2>Hem rebut la teva solicitud</h2>
      <p>Gracies, ${escapeHtml(data.name)}. Hem rebut la teva solicitud per a <strong>${escapeHtml(data.activityTitle)}</strong>.</p>
      <p>Et respondrem al mes aviat possible amb la disponibilitat i els seguents passos.</p>
      <ul>
        <li><strong>Data preferida:</strong> ${escapeHtml(data.preferredDate)}</li>
        <li><strong>Nombre de persones:</strong> ${escapeHtml(data.partySize)}</li>
        <li><strong>Telefon:</strong> ${escapeHtml(data.phone || "No proporcionat")}</li>
      </ul>
      ${data.message ? `<p><strong>Comentaris:</strong> ${escapeHtml(data.message)}</p>` : ""}
    `,
  };
}

function buildNewsletterEmail({ to }) {
  return {
    to: [{ email: getRequiredRecipient("newsletter", to) }],
    sender: getSender(),
    subject: "Bienvenido a nuestro newsletter",
    htmlContent: `
      <h2>Bienvenido a nuestro newsletter</h2>
      <p>Gracias por suscribirte. Recibiras nuestras ultimas novedades y ofertas exclusivas.</p>
      <p>Si no deseas recibir mas emails, puedes <a href="${process.env.URL}/unsubscribe">darte de baja aqui</a>.</p>
    `,
  };
}

function buildEmailConfig({ type, to, data }) {
  switch (type) {
    case "contact":
      return buildContactEmail({ data });
    case "order-confirmation":
      return buildOrderConfirmationEmail({ to, data });
    case "order-notification":
      return buildOrderNotificationEmail({ data });
    case "newsletter":
      return buildNewsletterEmail({ to });
    case "activity-booking-notification":
      return buildActivityBookingNotificationEmail({ data });
    case "activity-booking-confirmation":
      return buildActivityBookingConfirmationEmail({ to, data });
    default:
      throw new Error("Invalid email type");
  }
}

async function sendActivityBookingEmails({ to, data }) {
  const notificationConfig = withEmailContent(
    buildActivityBookingNotificationEmail({ data }),
  );
  const confirmationConfig = withEmailContent(
    buildActivityBookingConfirmationEmail({ to, data }),
  );

  await sendBrevoEmail(notificationConfig);
  await sendBrevoEmail(confirmationConfig);

  return { success: true };
}

async function sendBrevoEmail(emailConfig) {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(emailConfig),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API request failed: ${errorText}`);
  }

  return response.json();
}

async function sendEmail({ type, to, data }) {
  if (!isBrevoConfigured()) {
    throw new Error("Brevo environment is not configured");
  }

  if (type === "activity-booking") {
    if (!getRequiredRecipient("activity-booking-notification")) {
      throw new Error("Contact email is not configured");
    }

    if (!to) {
      throw new Error("Recipient email is required");
    }

    return sendActivityBookingEmails({ to, data });
  }

  const recipient = getRequiredRecipient(type, to);
  if (!recipient) {
    if (type === "contact" || type === "activity-booking-notification") {
      throw new Error("Contact email is not configured");
    }

    if (type === "order-notification") {
      throw new Error("Order notification email is not configured");
    }

    throw new Error("Recipient email is required");
  }

  const emailConfig = withEmailContent(buildEmailConfig({ type, to, data }));
  await sendBrevoEmail(emailConfig);
  return { success: true };
}

exports.sendEmail = sendEmail;
exports.isBrevoConfigured = isBrevoConfigured;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const { type, to, data } = JSON.parse(event.body || "{}");
    await sendEmail({ type, to, data });

    return jsonResponse(200, {
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Email sending error:", error);

    const statusCode =
      error.message === "Brevo environment is not configured" ? 503 : 500;
    return jsonResponse(statusCode, {
      success: false,
      error: "Failed to send email",
      details: error.message,
    });
  }
};
