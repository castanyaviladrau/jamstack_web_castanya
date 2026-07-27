const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const COMPANY = {
  legalName: "Castanya de Viladrau, S.C.P.",
  addressLine: "C/ de les afores, S/N, Mas Vidal",
  cityLine: "Viladrau (17406), Girona, España",
  nif: "J55051775",
  email: "info@castanyadeviladrau.cat",
  phone: "+34 681 31 199",
};

const LOGO_PATH = path.join(
  process.cwd(),
  "src",
  "assets",
  "images",
  "invoice-logo.png",
);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_SAFE_Y = 90;

const GRAY = rgb(0.93, 0.93, 0.93);
const LINE_GRAY = rgb(0.82, 0.82, 0.82);
const TEXT_DARK = rgb(0.15, 0.15, 0.15);
const TEXT_MUTED = rgb(0.4, 0.4, 0.4);

const COLUMNS = [
  { key: "concepto", label: "CONCEPTO", width: 140 },
  { key: "descripcion", label: "DESCRIPCIÓN", width: 110 },
  { key: "precio", label: "PRECIO", width: 55, align: "right" },
  { key: "unidades", label: "UNIDADES", width: 50, align: "right" },
  { key: "subtotal", label: "SUBTOTAL", width: 55, align: "right" },
  { key: "iva", label: "IVA", width: 30, align: "right" },
  { key: "total", label: "TOTAL", width: 55, align: "right" },
];

let colX = MARGIN;
COLUMNS.forEach((col) => {
  col.x = colX;
  colX += col.width;
});

function sanitizeText(value) {
  return String(value || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");
}

function eur(value) {
  return `${Number(value).toFixed(2).replace(".", ",")}€`;
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function wrapText(text, font, size, maxWidth) {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

async function buildOrderInvoicePdf({ code, date, client, items, shipping }) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  let logoImage = null;
  let logoDims = { width: 0, height: 0 };
  if (fs.existsSync(LOGO_PATH)) {
    const logoBytes = fs.readFileSync(LOGO_PATH);
    logoImage = await pdfDoc.embedPng(logoBytes);
    const scale = 60 / logoImage.height;
    logoDims = { width: logoImage.width * scale, height: 60 };
  }

  function drawText(text, x, y, { font = fontRegular, size = 9, color = TEXT_DARK, align } = {}) {
    const clean = sanitizeText(text);
    const drawX =
      align === "right" ? x - font.widthOfTextAtSize(clean, size) : align === "center" ? x - font.widthOfTextAtSize(clean, size) / 2 : x;
    page.drawText(clean, { x: drawX, y, size, font, color });
  }

  function ensureSpace(minY) {
    if (y >= minY) {
      return;
    }
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  let y = PAGE_HEIGHT - MARGIN;

  if (logoImage) {
    page.drawImage(logoImage, {
      x: MARGIN,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  const headerTextX = MARGIN + (logoImage ? logoDims.width + 14 : 0);
  let headerY = y - 10;

  [
    { text: COMPANY.legalName, font: fontBold, size: 11 },
    { text: COMPANY.addressLine, size: 9 },
    { text: COMPANY.cityLine, size: 9 },
    { text: COMPANY.nif, size: 9 },
    { text: COMPANY.email, size: 9 },
    { text: COMPANY.phone, size: 9 },
  ].forEach((line) => {
    drawText(line.text, headerTextX, headerY, { font: line.font, size: line.size });
    headerY -= line.size + 4;
  });

  y -= Math.max(logoDims.height, 6 * 13) + 26;

  page.drawRectangle({ x: MARGIN, y: y - 20, width: CONTENT_WIDTH, height: 22, color: GRAY });
  drawText("Cliente", MARGIN + CONTENT_WIDTH / 2, y - 14, { font: fontBold, size: 10, align: "center" });
  y -= 34;

  const clientLines = [
    client.company,
    client.vat ? `NIF/VAT: ${client.vat}` : null,
    !client.company || client.name !== client.company ? client.name : null,
    client.address,
    [client.postalCode, client.city].filter(Boolean).join(" "),
    client.country,
    client.email,
    client.phone,
  ].filter(Boolean);

  clientLines.forEach((line) => {
    drawText(line, MARGIN, y, { size: 9 });
    y -= 13;
  });

  y -= 14;

  drawText(`FACTURA #${code}`, MARGIN, y, { font: fontBold, size: 12 });
  y -= 16;
  drawText(`Fecha ${formatDate(date)}`, MARGIN, y, { size: 9, color: TEXT_MUTED });
  y -= 28;

  ensureSpace(BOTTOM_SAFE_Y + 40);
  page.drawRectangle({ x: MARGIN, y: y - 18, width: CONTENT_WIDTH, height: 20, color: GRAY });
  COLUMNS.forEach((col) => {
    const textX = col.align === "right" ? col.x + col.width : col.x;
    drawText(col.label, textX, y - 12, { font: fontBold, size: 8, align: col.align });
  });
  y -= 30;

  const rateGroups = new Map();
  const lineItems = [...items];

  if (shipping && shipping.amount > 0) {
    lineItems.push({
      name: "Despeses d'enviament",
      variantLabel: "",
      quantity: 1,
      lineTotal: shipping.amount,
      vatRate: shipping.vatRate ?? 0.21,
    });
  }

  let baseImponibleTotal = 0;
  let grandTotal = 0;

  lineItems.forEach((item) => {
    const gross = Number(item.lineTotal || 0);
    const rate = Number.isFinite(item.vatRate) ? item.vatRate : 0.21;
    const net = gross / (1 + rate);
    const ivaAmount = gross - net;
    const unitNet = net / (item.quantity || 1);

    baseImponibleTotal += net;
    grandTotal += gross;

    const group = rateGroups.get(rate) || { base: 0, iva: 0 };
    group.base += net;
    group.iva += ivaAmount;
    rateGroups.set(rate, group);

    const rowValues = {
      concepto: sanitizeText(item.name || "").toUpperCase(),
      descripcion: item.variantLabel || "",
      precio: eur(unitNet),
      unidades: String(item.quantity || 1),
      subtotal: eur(net),
      iva: `${Math.round(rate * 100)}%`,
      total: eur(gross),
    };

    const wrappedByColumn = COLUMNS.map((col) =>
      wrapText(rowValues[col.key], fontRegular, 8, col.width - 4),
    );
    const rowLineCount = Math.max(...wrappedByColumn.map((lines) => lines.length));
    const rowHeight = rowLineCount * 11 + 18;

    ensureSpace(BOTTOM_SAFE_Y + rowHeight);

    COLUMNS.forEach((col, colIndex) => {
      const textX = col.align === "right" ? col.x + col.width : col.x;
      wrappedByColumn[colIndex].forEach((lineText, lineIndex) => {
        drawText(lineText, textX, y - lineIndex * 11, {
          size: 8,
          align: col.align,
        });
      });
    });

    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 8 },
      end: { x: MARGIN + CONTENT_WIDTH, y: y + 8 },
      thickness: 0.5,
      color: LINE_GRAY,
    });
  });

  y -= 16;

  const totalsRows = [["BASE IMPONIBLE", eur(baseImponibleTotal)]];
  Array.from(rateGroups.keys())
    .sort((a, b) => b - a)
    .forEach((rate) => {
      totalsRows.push([`IVA ${Math.round(rate * 100)}%`, eur(rateGroups.get(rate).iva)]);
    });
  totalsRows.push(["TOTAL", eur(grandTotal)]);

  const totalsBoxWidth = 220;
  const totalsBoxX = MARGIN + CONTENT_WIDTH - totalsBoxWidth;
  const totalsRowHeight = 20;

  ensureSpace(BOTTOM_SAFE_Y + totalsRows.length * totalsRowHeight);

  totalsRows.forEach(([label, value], index) => {
    const rowTop = y - index * totalsRowHeight;
    if (index % 2 === 0) {
      page.drawRectangle({
        x: totalsBoxX,
        y: rowTop - totalsRowHeight + 6,
        width: totalsBoxWidth,
        height: totalsRowHeight,
        color: GRAY,
      });
    }
    drawText(label, totalsBoxX + totalsBoxWidth - 100, rowTop - 8, {
      font: fontBold,
      size: 9,
      align: "right",
    });
    drawText(value, totalsBoxX + totalsBoxWidth - 10, rowTop - 8, {
      font: fontBold,
      size: 9,
      align: "right",
    });
  });

  y -= totalsRows.length * totalsRowHeight + 26;

  ensureSpace(BOTTOM_SAFE_Y);
  drawText("Términos y condiciones:", MARGIN, y, { font: fontBold, size: 9 });
  y -= 13;

  const termsText =
    "En cumplimiento de lo que dispone el Reglamento General de Proteccion de Datos 2016/679, " +
    `${COMPANY.legalName} le informa que sus datos personales seran tratados e incorporados en ` +
    "nuestros sistemas informaticos, de los cuales es titular esta empresa.";

  wrapText(termsText, fontRegular, 8, CONTENT_WIDTH).forEach((line) => {
    ensureSpace(BOTTOM_SAFE_Y - 20);
    drawText(line, MARGIN, y, { size: 8, color: TEXT_MUTED });
    y -= 11;
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { buildOrderInvoicePdf, COMPANY };
