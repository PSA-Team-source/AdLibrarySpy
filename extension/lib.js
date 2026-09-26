// Pure helpers shared by the popup and tests/extension-lib.test.mjs.
// No chrome.* or DOM access here, so the logic runs under plain Node too.

export const SITE = 'https://adlibraryspy.com';
export const REF = 'ext:chrome';

/**
 * Runs INSIDE the inspected tab (chrome.scripting.executeScript, world MAIN),
 * so it must be self-contained: no closures over module scope.
 * Signals, strongest first — the same ones Koala / Wappalyzer-style detectors use:
 *   window.Shopify (the storefront runtime every Online Store page boots),
 *   <meta name="shopify-*"> tags and the "Shopify" generator,
 *   assets served from cdn.shopify.com or a store's own /cdn/shop/ path.
 */
export function detectShopify() {
  const out = { host: location.hostname, shopify: false, myshopify: null };
  try {
    const S = window.Shopify;
    if (S && typeof S === 'object') {
      if (typeof S.shop === 'string' && /\.myshopify\.com$/i.test(S.shop)) out.myshopify = S.shop.toLowerCase();
      if (out.myshopify || S.theme || S.routes || S.currency) out.shopify = true;
    }
    if (!out.shopify) {
      const q = s => document.querySelector(s);
      const gen = q('meta[name="generator" i]');
      out.shopify = !!(
        (gen && /shopify/i.test(gen.getAttribute('content') || '')) ||
        q('meta[name^="shopify-"]') ||
        q('link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"], link[href*="/cdn/shop/"], script[src*="/cdn/shop/"]')
      );
    }
  } catch { /* a hostile page can throw from getters; treat as "not detected" */ }
  return out;
}

/**
 * Bare lookup host for a page hostname, or null for anything that is not a
 * public DNS name (IPs, localhost, intranet names). Mirrors the server's
 * app/api/public/store/domain.ts — the server re-validates regardless.
 */
export function storeHost(hostname) {
  if (typeof hostname !== 'string') return null;
  let h = hostname.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (!h || h.length > 253) return null;
  const labels = h.split('.');
  if (labels.length < 2) return null;
  if (!labels.every(l => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l))) return null;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return null;
  if (/(^|\.)(localhost|local|internal|invalid|test|example)$/.test(h)) return null;
  return h;
}

/** Hosts to try, in order: the page's own host, then the store's myshopify.com name. */
export function lookupHosts(detected) {
  const hosts = [storeHost(detected && detected.host), storeHost(detected && detected.myshopify)];
  return hosts.filter((h, i) => h && hosts.indexOf(h) === i);
}

export function apiUrl(host) {
  return `${SITE}/api/public/store?domain=${encodeURIComponent(host)}`;
}

/** Only https URLs from the API reach an <img src> or <a href>. */
export function safeHttps(u) {
  if (typeof u !== 'string') return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function withRef(u) {
  const url = new URL(u);
  url.searchParams.set('ref', REF);
  return url.href;
}

export function signupUrl(appUrl) {
  const next = appUrl ? new URL(appUrl).pathname : '/shops';
  const url = new URL('/signup', SITE);
  url.searchParams.set('next', next);
  url.searchParams.set('ref', REF);
  return url.href;
}

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const compact = n => compactFmt.format(n);

/** "+7.0%" / "-1.7%"; null when there is nothing to say (null, NaN or rounds to 0). */
export function growthLabel(p) {
  if (typeof p !== 'number' || !Number.isFinite(p) || Math.abs(p) < 0.05) return null;
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
}

/** "2017-01-27" → "Jan 2017"; '' for anything unparseable. */
export function monthYear(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}/.test(iso)) return '';
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "US" → 🇺🇸; '' for anything that is not a two-letter code. */
export function flag(cc) {
  if (typeof cc !== 'string' || !/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0)));
}
