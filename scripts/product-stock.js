/**
 * Shared out-of-stock index, derived from the generated products.json.
 *
 * Only the Catalan product files live in the TinaCMS "products" collection, so
 * the editor flags stock once there. Every language then resolves stock by
 * slug/SKU through this index rather than from its own frontmatter, which is
 * what keeps /es/ and /en/ in step with a single toggle.
 */
const fs = require('fs');
const path = require('path');

const PRODUCTS_JSON = path.join(__dirname, '..', 'src', '_data', 'products.json');

let cache = null;
let cacheKey = '';

function build(list) {
  const bySlug = {};
  const bySku = {};
  const outOfStockSkus = [];

  list.forEach((product) => {
    const slug = String(product?.slug || '');
    if (!slug) {
      return;
    }

    const variants = {};
    (Array.isArray(product?.variants) ? product.variants : []).forEach((variant) => {
      const sku = String(variant?.sku || '');
      if (!sku) {
        return;
      }

      const isOut = variant?.outOfStock === true;
      variants[sku] = isOut;
      bySku[sku] = isOut;
      if (isOut) {
        outOfStockSkus.push(sku);
      }
    });

    bySlug[slug] = {
      outOfStock: product?.outOfStock === true,
      banner: product?.outOfStockBanner || {},
      note: product?.outOfStockNote || {},
      variants,
    };
  });

  outOfStockSkus.sort();
  return { bySlug, bySku, outOfStockSkus };
}

/**
 * Re-reads products.json whenever it changes on disk, so the Eleventy dev
 * server picks up a stock toggle without a restart.
 */
function loadStock() {
  let stat;
  try {
    stat = fs.statSync(PRODUCTS_JSON);
  } catch {
    return { bySlug: {}, bySku: {}, outOfStockSkus: [] };
  }

  const key = `${stat.mtimeMs}:${stat.size}`;
  if (cache && cacheKey === key) {
    return cache;
  }

  let list = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
    list = Array.isArray(parsed?.list) ? parsed.list : [];
  } catch {
    list = [];
  }

  cache = build(list);
  cacheKey = key;
  return cache;
}

/** Last path segment of a product URL, which is the slug in every language. */
function slugFromUrl(url) {
  const match = String(url || '').match(/\/products\/([^/]+)\/?$/);
  return match ? match[1] : '';
}

module.exports = { loadStock, slugFromUrl };
