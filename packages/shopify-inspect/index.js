// Read what a Shopify store publishes about itself, straight from its own
// public storefront: /meta.json, the homepage, the best-selling and newest
// collection order, and /products.json. Nothing is estimated. A value the store
// does not publish comes back null or empty.
import {
  normaliseDomain, isShopifyHtml, parseTheme, parseLocale, parseHandles, detectTech,
  productFromJson, productFromJs, priceStats,
} from './parse.js';

export * from './parse.js';

const UA = 'shopify-inspect/1.0 (+https://github.com/PSA-Team-source/adlibraryspy)';
const GRID = 12;

async function get(url, as, { timeoutMs, fetchImpl }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : 'text/html' },
      redirect: 'follow',
      signal: ac.signal,
    });
    if (!res.ok) return null;
    return as === 'json' ? await res.json() : await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} input  A domain or URL, e.g. "allbirds.com".
 * @param {{ timeoutMs?: number, fetch?: typeof fetch, limit?: number }} [opts]
 */
export async function inspectStore(input, opts = {}) {
  const domain = normaliseDomain(input);
  if (!domain) throw new Error(`Not a public store domain: ${input}`);
  const o = { timeoutMs: opts.timeoutMs ?? 8000, fetchImpl: opts.fetch ?? globalThis.fetch };
  const limit = Math.min(Math.max(opts.limit ?? GRID, 1), 50);
  const base = `https://${domain}`;

  // Shopify Markets prices the catalogue in the VISITOR's currency by IP, so
  // prices are requested in the store's own currency from /meta.json.
  const metaP = get(`${base}/meta.json`, 'json', o);
  const ccy = m => (/^[A-Z]{3}$/.test(m?.currency ?? '') ? `currency=${m.currency}` : '');
  const [meta, home, best, latest, catalog] = await Promise.all([
    metaP,
    get(`${base}/`, 'text', o),
    get(`${base}/collections/all?sort_by=best-selling`, 'text', o),
    get(`${base}/collections/all?sort_by=created-descending`, 'text', o),
    metaP.then(m => get(`${base}/products.json?limit=250${ccy(m) ? `&${ccy(m)}` : ''}`, 'json', o)),
  ]);

  const m = meta && typeof meta === 'object' ? meta : {};
  const html = typeof home === 'string' ? home : '';
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const shopify = !!(m.myshopify_domain || isShopifyHtml(html) || products.length);
  const currency = typeof m.currency === 'string' ? m.currency : null;

  const byHandle = new Map();
  for (const p of products) if (p?.handle) byHandle.set(String(p.handle).toLowerCase(), p);
  const bestHandles = typeof best === 'string' ? parseHandles(best, limit) : [];
  const latestHandles = typeof latest === 'string' ? parseHandles(latest, limit) : [];

  // Handles past the first 250 catalogue rows: one bounded .js lookup each.
  const missing = [...new Set([...bestHandles, ...latestHandles])].filter(h => !byHandle.has(h)).slice(0, limit);
  const extra = new Map();
  await Promise.all(missing.map(async h => {
    const p = await get(`${base}/products/${encodeURIComponent(h)}.js${ccy(m) ? `?${ccy(m)}` : ''}`, 'json', o);
    if (p && typeof p === 'object') extra.set(h, productFromJs(p, currency));
  }));

  const resolve = handles => handles
    .map(h => (byHandle.has(h) ? productFromJson(byHandle.get(h), currency) : extra.get(h)))
    .filter(p => p && p.title)
    .map((p, i) => ({ rank: i + 1, ...p, url: p.handle ? `${base}/products/${p.handle}` : null }));

  const count = Number(m.published_products_count);
  return {
    domain,
    shopify,
    name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : null,
    myshopifyDomain: typeof m.myshopify_domain === 'string' ? m.myshopify_domain : null,
    currency,
    locale: parseLocale(html) || null,
    theme: parseTheme(html) || null,
    productCount: Number.isFinite(count) && count > 0 ? count : null,
    prices: priceStats(products.map(p => productFromJson(p, currency))),
    bestSelling: resolve(bestHandles),
    newest: resolve(latestHandles),
    ...detectTech(html),
    inspectedAt: new Date().toISOString(),
  };
}
