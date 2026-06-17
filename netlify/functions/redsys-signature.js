const crypto = require('crypto');

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function normalizeBase64Url(value) {
  return toBase64Url(fromBase64Url(value));
}

function normalizeTerminalSecretKey(secretKey) {
  const normalized = String(secretKey || '').trim();

  if (!normalized) {
    throw new Error('Missing RedSys secret key');
  }

  return normalized.length >= 16
    ? normalized.slice(0, 16)
    : normalized.padEnd(16, '0');
}

function getOrderValue(parameters = {}) {
  return String(
    parameters.DS_MERCHANT_ORDER ||
      parameters.Ds_Merchant_Order ||
      parameters.DS_ORDER ||
      parameters.Ds_Order ||
      '',
  ).trim();
}

function encodeMerchantParameters(parameters) {
  return Buffer.from(JSON.stringify(parameters), 'utf8').toString('base64url');
}

function decodeMerchantParameters(merchantParameters) {
  return JSON.parse(fromBase64Url(merchantParameters).toString('utf8'));
}

function deriveOperationKey(order, secretKey) {
  const keyBytes = Buffer.from(normalizeTerminalSecretKey(secretKey), 'utf8');
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv('aes-128-cbc', keyBytes, iv);
  const encrypted = Buffer.concat([cipher.update(String(order || ''), 'utf8'), cipher.final()]);

  // Match the official Java SDK: AES-CBC encrypt the order, Base64-encode the
  // encrypted bytes, then use the UTF-8 bytes of that Base64 string as the HMAC key.
  return Buffer.from(encrypted.toString('base64'), 'utf8');
}

function createSignature(merchantParameters, order, secretKey) {
  const operationKey = deriveOperationKey(order, secretKey);
  const hmac = crypto.createHmac('sha512', operationKey);
  hmac.update(String(merchantParameters || ''));
  return hmac.digest('base64url');
}

function verifyMerchantParametersSignature(merchantParameters, signature, secretKey) {
  const parameters = decodeMerchantParameters(merchantParameters);
  const order = getOrderValue(parameters);

  if (!order) {
    throw new Error('Missing order value in signed parameters');
  }

  const expectedSignature = createSignature(merchantParameters, order, secretKey);

  return {
    isValid: normalizeBase64Url(signature) === normalizeBase64Url(expectedSignature),
    parameters,
    expectedSignature,
  };
}

module.exports = {
  createSignature,
  decodeMerchantParameters,
  encodeMerchantParameters,
  fromBase64Url,
  getOrderValue,
  normalizeBase64Url,
  normalizeTerminalSecretKey,
  toBase64Url,
  verifyMerchantParametersSignature,
};
