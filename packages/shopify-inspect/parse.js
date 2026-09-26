// Parsers for a Shopify storefront's own HTML and JSON. Pure functions, no I/O,
// so they run (and are tested) under plain Node.

const str = v => (typeof v === 'string' ? v.trim() : '');

/**
 * Normalise user input ("https://www.Allbirds.com/products/x") to a bare public
 * hostname ("allbirds.com"), or null when it is not a public DNS name.
 */
export function normaliseDomain(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().toLowerCase();
  if (!h) return null;
  try {
    h = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(h) ? h : `https://${h}`).hostname;
  } catch {
    return null;
  }
  h = h.replace(/\.$/, '').replace(/^www\./, '');
  if (!h || h.length > 253) return null;
  const labels = h.split('.');
  if (labels.length < 2) return null;
  if (!labels.every(l => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l))) return null;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return null;
  if (/(^|\.)(localhost|local|internal|invalid|test|example)$/.test(h)) return null;
  return h;
}

/** True when the page boots the Shopify storefront runtime or serves Shopify's CDN assets. */
export function isShopifyHtml(html) {
  return /\bShopify\.(?:shop|theme|routes|currency)\s*=|cdn\.shopify\.com|\/cdn\/shop\/|<meta[^>]+name="shopify-/i.test(html);
}

/** Shopify.theme = {...}; → schema_name ("Dawn", "Impulse"). The merchant's own copy name is not a theme name. */
export function parseTheme(html) {
  const m = html.match(/Shopify\.theme\s*=\s*(\{[^;]*?\})\s*;/);
  if (!m) return '';
  try { return str(JSON.parse(m[1]).schema_name); } catch { return ''; }
}

export function parseLocale(html) {
  return html.match(/Shopify\.locale\s*=\s*"([A-Za-z-]{2,10})"/)?.[1]
    ?? html.match(/<html[^>]*\slang="([A-Za-z-]{2,10})"/i)?.[1] ?? '';
}

/**
 * Product handles in the order a collection page renders them. Read from
 * <main> onward so header and menu links do not jump the queue.
 */
export function parseHandles(html, max = 12) {
  const start = html.search(/<main[\s>]/i);
  const body = start >= 0 ? html.slice(start) : html;
  const out = [];
  for (const m of body.matchAll(/href="[^"]*\/products\/([^"?#/]+)/g)) {
    let h;
    try { h = decodeURIComponent(m[1]).toLowerCase(); } catch { continue; }
    if (!out.includes(h)) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Third-party apps and tracking pixels, detected by the vendor hosts or loader
 * globals their scripts put in the storefront HTML. Only what the homepage
 * itself loads is seen: an app injected later (on scroll, on the product page,
 * through a tag manager) is not, so absence here is not proof it is missing.
 */
export const SIGNATURES = [
  // Pixels and analytics
  ['Meta Pixel', 'pixel', /connect\.facebook\.net\/[^"']*fbevents\.js|\bfbq\(\s*['"]init/],
  ['TikTok Pixel', 'pixel', /analytics\.tiktok\.com/],
  ['Pinterest Tag', 'pixel', /s\.pinimg\.com\/ct\/core\.js|\bpintrk\(/],
  ['Snap Pixel', 'pixel', /sc-static\.net\/scevent\.min\.js/],
  ['Google Tag Manager', 'pixel', /googletagmanager\.com\/gtm\.js/],
  ['Google Analytics 4', 'pixel', /googletagmanager\.com\/gtag\/js\?id=G-/],
  ['Google Ads', 'pixel', /googletagmanager\.com\/gtag\/js\?id=AW-/],
  ['Microsoft Clarity', 'pixel', /clarity\.ms\/tag/],
  ['Hotjar', 'pixel', /static\.hotjar\.com/],
  ['Elevar', 'pixel', /getelevar\.com/],
  ['Triple Whale', 'pixel', /triplewhale|triplepixel/i],
  // Email and SMS
  ['Klaviyo', 'app', /static\.klaviyo\.com|klaviyo\.com\/onsite/],
  ['Omnisend', 'app', /omnisnippet|omnisrc\.com/],
  ['Attentive', 'app', /cdn\.attn\.tv/],
  ['Postscript', 'app', /sdk\.postscript\.io/],
  ['Privy', 'app', /widget\.privy\.com/],
  ['Justuno', 'app', /justuno\.com/],
  // Reviews and loyalty
  ['Judge.me', 'app', /judge\.me/],
  ['Yotpo', 'app', /yotpo\.com/],
  ['Okendo', 'app', /okendo\.io/],
  ['Loox', 'app', /loox\.io/],
  ['Stamped', 'app', /stamped\.io/],
  ['Smile.io', 'app', /js\.smile\.io/],
  // Subscriptions, upsells, CRO
  ['Recharge', 'app', /rechargecdn\.com|rechargeapps\.com/],
  ['Rebuy', 'app', /rebuyengine\.com/],
  ['Intelligems', 'app', /intelligems\.io/],
  ['Nosto', 'app', /nosto\.com/],
  // Search
  ['Searchanise', 'app', /searchanise/],
  ['Boost Commerce', 'app', /boostcommerce\.(?:net|io)/],
  // Support
  ['Gorgias', 'app', /gorgias\.chat|config\.gorgias\.io/],
  ['Zendesk', 'app', /static\.zdassets\.com/],
  ['Tidio', 'app', /code\.tidio\.co/],
  // Payments and post-purchase
  ['Klarna', 'app', /js\.klarna\.com|klarnaservices\.com/],
  ['Afterpay', 'app', /js\.afterpay\.com|static\.afterpay\.com/],
  ['Affirm', 'app', /cdn1\.affirm\.com/],
  ['Route', 'app', /cdn\.routeapp\.io/],
  ['AfterShip', 'app', /aftership\.com/],
  // Page builders
  ['PageFly', 'app', /pagefly/i],
  ['GemPages', 'app', /gempages/i],
  ['Shogun', 'app', /getshogun\.com/],
  ['Replo', 'app', /replocdn\.com|replo\.app/],
];

/** { pixels: string[], apps: string[] } found in the HTML, in SIGNATURES order. */
export function detectTech(html) {
  const pixels = [];
  const apps = [];
  for (const [name, kind, re] of SIGNATURES) {
    if (re.test(html)) (kind === 'pixel' ? pixels : apps).push(name);
  }
  return { pixels, apps };
}

const img = src => {
  const s = str(src);
  return s.startsWith('//') ? `https:${s}` : s;
};

/** A /products.json row (variant price is a decimal string). */
export function productFromJson(p, currency) {
  const price = Number(p?.variants?.[0]?.price);
  return {
    title: str(p?.title).slice(0, 120),
    handle: str(p?.handle),
    price: Number.isFinite(price) ? price : null,
    currency,
    createdAt: str(p?.created_at).slice(0, 10) || null,
    image: img(p?.images?.[0]?.src) || null,
  };
}

/** A /products/{handle}.js row (price is in minor units). */
export function productFromJs(p, currency) {
  const cents = Number(p?.price);
  return {
    title: str(p?.title).slice(0, 120),
    handle: str(p?.handle),
    price: Number.isFinite(cents) ? cents / 100 : null,
    currency,
    createdAt: str(p?.created_at).slice(0, 10) || null,
    image: img(p?.featured_image) || null,
  };
}

/** Price spread of a catalogue sample; null when no product carries a price. */
export function priceStats(products) {
  const prices = products.map(p => p.price).filter(n => typeof n === 'number' && n > 0).sort((a, b) => a - b);
  if (!prices.length) return null;
  const mid = prices.length >> 1;
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return { sampled: prices.length, min: prices[0], median: Math.round(median * 100) / 100, max: prices[prices.length - 1] };
}
