/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const LANGS = ['ca', 'es', 'en'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Per-language override blocks (banner / note). Returns undefined when the
// editor left every language blank, so products.json stays free of empty noise.
function langBlock(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};

  LANGS.forEach((lang) => {
    const entry = text(source[lang]);
    if (entry) {
      result[lang] = entry;
    }
  });

  return Object.keys(result).length ? result : undefined;
}

function parseProduct(data) {
  const slugMatch = text(data.permalink).match(/\/shop\/products\/([^/]+)\//);
  const productOutOfStock = data.outOfStock === true;

  const variants = (Array.isArray(data.formats) ? data.formats : [])
    .map((format) => {
      const entry = format && typeof format === 'object' ? format : {};
      return {
        sku: text(entry.sku),
        label: text(entry.label),
        price: Number(entry.price),
        // A product-level flag takes every one of its formats off sale.
        outOfStock: productOutOfStock || entry.outOfStock === true,
      };
    })
    .filter((variant) => variant.sku && variant.label && Number.isFinite(variant.price));

  return {
    slug: slugMatch ? slugMatch[1] : '',
    name: text(data.title),
    currency: text(data.currency) || 'EUR',
    image: text(data.image),
    // Out of stock either because the editor flagged the whole product, or
    // because every single format sold out individually.
    outOfStock:
      productOutOfStock ||
      (variants.length > 0 && variants.every((variant) => variant.outOfStock)),
    outOfStockBanner: langBlock(data.outOfStockBanner),
    outOfStockNote: langBlock(data.outOfStockNote),
    variants,
  };
}

function generate() {
  const repoRoot = process.cwd();
  const productsDir = path.join(repoRoot, 'src', 'shop', 'products');
  const outFile = path.join(repoRoot, 'src', '_data', 'products.json');

  const entries = fs.readdirSync(productsDir, { withFileTypes: true });
  const products = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(productsDir, entry.name);
    let parsed;

    try {
      parsed = matter(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.warn(`Skipping ${entry.name}: ${error.message}`);
      continue;
    }

    const product = parseProduct(parsed.data || {});
    if (!product.slug) {
      product.slug = path.basename(entry.name, '.md');
    }

    if (!product.name || !product.variants.length) {
      console.warn(`Skipping ${entry.name}: missing title or formats`);
      continue;
    }

    products.push(product);
  }

  products.sort((a, b) => a.slug.localeCompare(b.slug));
  return JSON.stringify({ list: products }, null, 2) + '\n';
}

// Only touch the file when something actually changed: an unconditional write
// bumps its mtime, which would make the Eleventy dev server rebuild forever.
function writeIfChanged() {
  const outFile = path.join(process.cwd(), 'src', '_data', 'products.json');
  const payload = generate();
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;

  if (current === payload) {
    return { outFile, changed: false };
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, payload, 'utf8');
  return { outFile, changed: true };
}

module.exports = { generate, writeIfChanged };

if (require.main === module) {
  const { outFile, changed } = writeIfChanged();
  console.log(`${changed ? 'Wrote' : 'Unchanged'} ${outFile}`);
}
