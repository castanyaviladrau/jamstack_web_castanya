const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOrderInvoicePdf } = require('../netlify/functions/lib/invoice-pdf');

test('buildOrderInvoicePdf generates a valid PDF buffer', async () => {
  const pdfBuffer = await buildOrderInvoicePdf({
    code: 'CV-TEST-0001',
    date: new Date('2026-03-08T00:00:00.000Z'),
    client: {
      company: 'Xalet la Coromina',
      vat: 'B12345678',
      name: 'Xalet la Coromina',
      address: 'Carrer Major, 1',
      city: 'Viladrau',
      postalCode: '17406',
      country: 'ES',
      email: 'client@example.com',
      phone: '+34600000000',
    },
    items: [
      { name: 'Licor de castanya', variantLabel: 'Ampolla de 50 cl', quantity: 2, lineTotal: 42.02, vatRate: 0.21 },
      { name: 'Marron glace', variantLabel: '2 unitats', quantity: 2, lineTotal: 7.2, vatRate: 0.1 },
    ],
    shipping: { amount: 0 },
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.equal(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
  assert.ok(pdfBuffer.length > 1000);
});

test('buildOrderInvoicePdf handles many items across multiple pages', async () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    name: `Producte ${index + 1}`,
    variantLabel: 'Format estandard',
    quantity: 1,
    lineTotal: 10,
    vatRate: 0.1,
  }));

  const pdfBuffer = await buildOrderInvoicePdf({
    code: 'CV-TEST-0002',
    date: new Date('2026-03-08T00:00:00.000Z'),
    client: { name: 'Client de prova', email: 'client@example.com' },
    items,
    shipping: { amount: 5, vatRate: 0.21 },
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.equal(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
});
