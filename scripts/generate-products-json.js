/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function readFrontmatter(markdown) {
  const text = String(markdown || '');
  if (!text.startsWith('---')) {
    return null;
  }

  const endIndex = text.indexOf('\n---', 3);
  if (endIndex === -1) {
    return null;
  }

  return text.slice(3, endIndex + 1).trimEnd();
}

function parseScalar(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const numberValue = Number(raw);
  if (Number.isFinite(numberValue) && String(numberValue) === raw) {
    return numberValue;
  }

  return raw;
}

function parseProductFrontmatter(frontmatter) {
  const lines = String(frontmatter || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, '  '));

  const product = {
    slug: '',
    name: '',
    currency: 'EUR',
    image: '',
    variants: [],
  };

  let currentList = null;
  let currentEntry = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith('formats:')) {
      currentList = 'formats';
      currentEntry = null;
      continue;
    }

    if (currentList === 'formats' && line.trimStart().startsWith('- ')) {
      currentEntry = {};
      product.variants.push(currentEntry);
      const rest = line.trimStart().slice(2).trim();
      if (rest.includes(':')) {
        const [k, ...v] = rest.split(':');
        currentEntry[k.trim()] = parseScalar(v.join(':'));
      }
      continue;
    }

    if (currentList === 'formats' && currentEntry && /^\s{2,}\w+\s*:/.test(line)) {
      const trimmed = line.trim();
      const [k, ...v] = trimmed.split(':');
      currentEntry[k.trim()] = parseScalar(v.join(':'));
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed.includes(':')) {
      continue;
    }

    const [key, ...rest] = trimmed.split(':');
    const value = rest.join(':').trim();

    if (key === 'permalink') {
      const match = value.match(/\/shop\/products\/([^/]+)\//);
      if (match) {
        product.slug = match[1];
      }
    }

    if (key === 'title') {
      product.name = String(parseScalar(value));
    }

    if (key === 'currency') {
      product.currency = String(parseScalar(value) || 'EUR');
    }

    if (key === 'image') {
      product.image = String(parseScalar(value));
    }
  }

  product.variants = product.variants
    .map((variant) => ({
      sku: String(variant.sku || '').trim(),
      label: String(variant.label || '').trim(),
      price: Number(variant.price),
    }))
    .filter((variant) => variant.sku && variant.label && Number.isFinite(variant.price));

  return product;
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
    const content = fs.readFileSync(filePath, 'utf8');
    const fm = readFrontmatter(content);
    if (!fm) {
      console.warn(`Skipping ${entry.name}: missing frontmatter`);
      continue;
    }

    const product = parseProductFrontmatter(fm);
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
  const payload = JSON.stringify({ list: products }, null, 2) + '\n';
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, payload, 'utf8');

  console.log(`Wrote ${outFile} (${products.length} products)`);
}

generate();
