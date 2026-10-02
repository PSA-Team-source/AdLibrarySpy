// Pure-logic tests: no DB, no network. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ---------- PKCE ----------
function verifyPkce(verifier, challenge) {
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(computed), b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

test('PKCE S256 accepts the matching verifier', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  assert.equal(verifyPkce(verifier, challenge), true);
});

test('PKCE S256 rejects a wrong verifier', () => {
  const challenge = crypto.createHash('sha256').update('correct-verifier').digest('base64url');
  assert.equal(verifyPkce('wrong-verifier', challenge), false);
});

test('PKCE rejects a plain (non-hashed) challenge', () => {
  const verifier = 'abc123abc123abc123abc123abc123abc123abc123';
  assert.equal(verifyPkce(verifier, verifier), false);
});

// ---------- redirect_uri matching ----------
const redirectAllowed = (uris, uri) => uris.includes(uri);

test('redirect_uri must match exactly, not by prefix', () => {
  const registered = ['https://claude.ai/api/mcp/auth_callback'];
  assert.equal(redirectAllowed(registered, 'https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(redirectAllowed(registered, 'https://claude.ai/api/mcp/auth_callback/../evil'), false);
  assert.equal(redirectAllowed(registered, 'https://claude.ai.evil.com/api/mcp/auth_callback'), false);
  assert.equal(redirectAllowed(registered, 'https://claude.ai/api/mcp/auth_callback?x=1'), false);
});

// ---------- traffic points: no fabrication ----------
// Mirrors indexTrafficPoints(): only real YYYYMM keys with positive values.
function indexTrafficPoints(raw) {
  if (!Array.isArray(raw)) return [];
  const pts = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    for (const [k, v] of Object.entries(row)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (!/^\d{6}$/.test(String(k))) continue;
      pts.push({ t: `${k.slice(0, 4)}-${k.slice(4, 6)}`, v: n });
    }
  }
  return pts.sort((a, b) => a.t.localeCompare(b.t));
}

test('traffic points come only from real index months', () => {
  const pts = indexTrafficPoints([{ '202608': 178145790 }, { '202607': 206881895 }]);
  assert.deepEqual(pts, [
    { t: '2026-07', v: 206881895 },
    { t: '2026-08', v: 178145790 },
  ]);
});

test('traffic points drop zero, negative and malformed entries', () => {
  const pts = indexTrafficPoints([{ '202608': 0 }, { bogus: 500 }, { '202607': -3 }, { '202606': 100 }]);
  assert.deepEqual(pts, [{ t: '2026-06', v: 100 }]);
});

test('an empty index series produces no points, never invented ones', () => {
  assert.deepEqual(indexTrafficPoints(null), []);
  assert.deepEqual(indexTrafficPoints([]), []);
});

// ---------- charts refuse to draw a line from one point ----------
const MIN_POINTS = 2;
const chartRenders = data => Array.isArray(data) && data.length >= MIN_POINTS;

test('a chart needs at least two measured points', () => {
  assert.equal(chartRenders([]), false);
  assert.equal(chartRenders([{ t: '2026-08', v: 5 }]), false);
  assert.equal(chartRenders([{ t: '2026-07', v: 4 }, { t: '2026-08', v: 5 }]), true);
});

// ---------- domain cleaning ----------
const cleanDomain = u => String(u || '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

test('domains normalise consistently', () => {
  assert.equal(cleanDomain('https://www.Gymshark.com/collections/all'), 'gymshark.com');
  assert.equal(cleanDomain('HTTP://store.nytimes.com/'), 'store.nytimes.com');
  assert.equal(cleanDomain('https://shop.com?utm=x'), 'shop.com');
  assert.equal(cleanDomain(''), '');
});

// ---------- crawler-artifact brand titles ----------
// Mirrors brandName() in lib/market/shops.ts. ~3% of index rows store the
// crawler's error page as store_title; those must not render as brand names.
const CRAWL_ARTIFACT = /^\s*\d{3}\s+(moved|found|not found|forbidden|bad gateway|service unavailable|internal server error|unauthorized|gone)\b|moved permanently|moved temporarily|^not found$|^forbidden$|bad gateway|service unavailable|access denied|just a moment|attention required|are you a robot|checking your browser|enable javascript|^error$/i;
const brandName = (title, domain) => {
  const t = String(title ?? '').trim();
  return !t || CRAWL_ARTIFACT.test(t) ? domain : t;
};

test('crawler error pages fall back to the domain', () => {
  assert.equal(brandName('301 Moved Permanently', 'my.thevan.nike.com'), 'my.thevan.nike.com');
  assert.equal(brandName('Attention Required! | Cloudflare', 'topps.com'), 'topps.com');
  assert.equal(brandName('Just a moment...', 'mediamarkt.es'), 'mediamarkt.es');
  assert.equal(brandName('', 'blank.com'), 'blank.com');
  assert.equal(brandName(null, 'null.com'), 'null.com');
});

test('real brand names are left untouched', () => {
  assert.equal(brandName('The New York Times Store', 'store.nytimes.com'), 'The New York Times Store');
  assert.equal(brandName('Gymshark', 'gymshark.com'), 'Gymshark');
  assert.equal(brandName('Levi Strauss & Co', 'levi.com'), 'Levi Strauss & Co');
  // A bare status code must not reject a real brand.
  assert.equal(brandName('404 Ink', '404ink.com'), '404 Ink');
  assert.equal(brandName('500 Startups', '500.co'), '500 Startups');
  assert.equal(brandName('302 Skincare', '302skincare.com'), '302 Skincare');
});

// ---------- creative media host allowlist ----------
// Mirrors playableUrl() in lib/market/creatives.ts. The index stores both our
// cached copy and the original Facebook CDN URL; measured against live rows the
// fbcdn links are expired signed URLs that 403, so only the cache is servable.
const MEDIA_HOST = 'cdn.shopquantum.ai';
const OWN_HOST = 'media.adlibraryspy.com';
const OWN_PATH = '/creatives/';
const OLD_STORAGE_HOST = 'storage.platformdtc.com';
const OLD_STORAGE_PATH = '/platformdtc/creatives/';
const playableUrl = (raw) => {
  const url = String(raw ?? '');
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '';
    if (u.host === MEDIA_HOST || (u.host === OWN_HOST && u.pathname.startsWith(OWN_PATH))) return url;
    if (u.host === OLD_STORAGE_HOST && u.pathname.startsWith(OLD_STORAGE_PATH)) {
      return `https://${OWN_HOST}${OWN_PATH}${u.pathname.slice(OLD_STORAGE_PATH.length)}`;
    }
    return '';
  } catch { return ''; }
};

test('only CDN-hosted creative media is servable', () => {
  const ok = 'https://cdn.shopquantum.ai/creative_096/abc.jpg';
  assert.equal(playableUrl(ok), ok);
  assert.equal(playableUrl('https://scontent.fhan15-2.fna.fbcdn.net/v/t39.35426-6/x.jpg'), '');
  assert.equal(playableUrl('https://video.fhan15-1.fna.fbcdn.net/o1/v/t2/f2/m366/x.mp4'), '');
  assert.equal(playableUrl(''), '');
  assert.equal(playableUrl(null), '');
  assert.equal(playableUrl('not a url'), '');
});

test('a lookalike host does not pass the allowlist', () => {
  assert.equal(playableUrl('https://cdn.shopquantum.ai.evil.com/x.jpg'), '');
  assert.equal(playableUrl('https://evil.com/cdn.shopquantum.ai/x.jpg'), '');
});

test('own media host passes; old PlatformDTC storage URLs move to it; /platformdtc/crawl/ never does', () => {
  const ok = 'https://media.adlibraryspy.com/creatives/0123abcd.mp4';
  assert.equal(playableUrl(ok), ok);
  assert.equal(playableUrl('https://storage.platformdtc.com/platformdtc/creatives/0123abcd.mp4'), ok);
  assert.equal(playableUrl('https://media.adlibraryspy.com/other/x.jpg'), '');
  assert.equal(playableUrl('https://storage.platformdtc.com/platformdtc/crawl/0123abcd.jpg'), '');
  assert.equal(playableUrl('https://storage.platformdtc.com/other/x.jpg'), '');
});

// ---------- UTM decode ----------
const utmOf = (linkUrl) => {
  if (!linkUrl) return {};
  try {
    const out = {};
    for (const [k, v] of new URL(linkUrl).searchParams) {
      if (k.toLowerCase().startsWith('utm_') && v) out[k.toLowerCase()] = v.slice(0, 200);
    }
    return out;
  } catch { return {}; }
};

test('UTM parameters decode from the real destination', () => {
  const link = 'https://buy.cheezit.com/social/67d?utm_source=meta&utm_medium=paid_social'
             + '&utm_campaign=knva_sal_chz_bb_kna_us_2026_q2&utm_content=types_of_hoop_watchers';
  assert.deepEqual(utmOf(link), {
    utm_source: 'meta',
    utm_medium: 'paid_social',
    utm_campaign: 'knva_sal_chz_bb_kna_us_2026_q2',
    utm_content: 'types_of_hoop_watchers',
  });
});

test('non-UTM query params are ignored and bad URLs are safe', () => {
  assert.deepEqual(utmOf('https://x.com/p?ref=abc&fbclid=123'), {});
  assert.deepEqual(utmOf('https://x.com/p?utm_source=&utm_medium=cpc'), { utm_medium: 'cpc' });
  assert.deepEqual(utmOf('not-a-url'), {});
  assert.deepEqual(utmOf(''), {});
});

// ---------- liquid templates are not ad copy ----------
const adCopyOf = (description) => {
  const d = String(description ?? '').trim();
  return /^\s*(\{\{|\{%)/.test(d) ? '' : d;
};

test('unrendered templates are dropped rather than shown as ad copy', () => {
  assert.equal(adCopyOf('{{product.brand}}'), '');
  assert.equal(adCopyOf('{% if x %}y{% endif %}'), '');
  assert.equal(adCopyOf('Real ad copy about {{ nothing }}'), 'Real ad copy about {{ nothing }}');
  assert.equal(adCopyOf('  Trimmed copy  '), 'Trimmed copy');
});

// ---------- scan-until-filled paging ----------
// Renderable rows are unevenly distributed across API pages (popular measured
// p1:0 p2:1 p3:0 p4:4 p5:41), so a 1:1 page mapping renders an empty page one.
function collectWindow(apiPages, logicalPage, limit, maxPages = 12) {
  const need = logicalPage * limit;
  const collected = [];
  for (let i = 0; i < Math.min(apiPages.length, maxPages) && collected.length < need + 1; i++) {
    if (apiPages[i] === 0) { /* page returned rows, none renderable */ }
    collected.push(...Array.from({ length: apiPages[i] }, (_, j) => `p${i + 1}-${j}`));
  }
  const skip = (logicalPage - 1) * limit;
  return { items: collected.slice(skip, skip + limit), collected: collected.length };
}

test('scanning fills page one despite empty leading API pages', () => {
  const popular = [0, 1, 0, 4, 41, 33, 23, 55];
  const r = collectWindow(popular, 1, 24);
  assert.equal(r.items.length, 24, 'page one should be full');
});

test('scanning still pages correctly into the second window', () => {
  const popular = [0, 1, 0, 4, 41, 33, 23, 55];
  const r = collectWindow(popular, 2, 24);
  assert.equal(r.items.length, 24);
  // page two must not repeat page one's rows
  const p1 = collectWindow(popular, 1, 24).items;
  assert.equal(p1.some(x => r.items.includes(x)), false);
});

test('a mode with no renderable rows yields an empty page, not a crash', () => {
  const recent = [0, 0, 0, 0, 0, 0];
  assert.deepEqual(collectWindow(recent, 1, 24).items, []);
});

// ---------- top-brands query parameter names ----------
// These names are load-bearing and fail SILENTLY: GET /top-brands ignores an
// unknown parameter rather than rejecting it, so `country=GB` returned the full
// 1,339,926-row baseline while `selectedCountry=GB` returned 114,128 GB stores.
// Verified against the live API. Do not "tidy" these names.
function toParams(f) {
  const p = new URLSearchParams();
  p.set('limit', String(Math.min(100, Math.max(1, f.limit ?? 25))));
  p.set('page', String(Math.max(1, f.page ?? 1)));
  if (f.platform !== 'all') p.set('platform', f.platform || 'shopify');
  if (f.country) p.set('selectedCountry', f.country);
  if (f.category) p.set('selectedStoreCategoryId', f.category);
  if (f.q) p.set('searchQuery', f.q);
  p.set('sortBy', f.sortBy || 'sw_visits');
  p.set('sortOrder', f.sortOrder || 'desc');
  return p;
}

test('top-brands uses the parameter names the API reads', () => {
  const p = toParams({ country: 'GB', category: '4114', q: 'gym' });
  assert.equal(p.get('selectedCountry'), 'GB');
  assert.equal(p.get('selectedStoreCategoryId'), '4114');
  assert.equal(p.get('searchQuery'), 'gym');
  // the names that are silently ignored must not be sent
  assert.equal(p.get('country'), null);
  assert.equal(p.get('storeCategoryId'), null);
  assert.equal(p.get('search'), null);
});

test('an unsorted list asks for measured SimilarWeb visits', () => {
  assert.equal(toParams({}).get('sortBy'), 'sw_visits');
  assert.equal(toParams({ sortBy: 'max_ads_7d' }).get('sortBy'), 'max_ads_7d');
});

test('platform defaults to shopify and "all" removes the filter', () => {
  assert.equal(toParams({}).get('platform'), 'shopify');
  assert.equal(toParams({ platform: 'woocommerce' }).get('platform'), 'woocommerce');
  assert.equal(toParams({ platform: 'all' }).get('platform'), null);
});

// ---------- range filters go on the POST endpoint, in cents ----------
function rangeBody(f) {
  const body = { page: Math.max(1, f.page ?? 1), limit: 25,
                 sort: { field: f.sortBy || 'sw_visits', order: 'desc' } };
  if (f.productsMin != null) body.totalProducts = { min: f.productsMin };
  if (f.avgPriceMin != null) body.avgPrice = { min: Math.round(f.avgPriceMin * 100) };
  if (f.trafficMin != null) body.similarwebVisits = { min: f.trafficMin };
  if (f.growthMax != null) body.similarwebGrowth = { max: f.growthMax };
  if (f.visitorCountry) body.visitorCountry = f.visitorCountry;
  if (f.createdAfter) body.createdAfter = f.createdAfter;
  return body;
}

test('average price range converts dollars to the cents the index stores', () => {
  assert.deepEqual(rangeBody({ avgPriceMin: 100 }).avgPrice, { min: 10000 });
  assert.deepEqual(rangeBody({ avgPriceMin: 24.5 }).avgPrice, { min: 2450 });
});

test('catalogue range is passed through as a plain count', () => {
  assert.deepEqual(rangeBody({ productsMin: 500 }).totalProducts, { min: 500 });
});

test('shop parity filters use exact-host traffic fields and real dimensions', () => {
  const body = rangeBody({
    trafficMin: 100000,
    growthMax: -0.01,
    visitorCountry: 'US',
    createdAfter: '2026-06-01T00:00:00.000Z',
  });
  assert.deepEqual(body.similarwebVisits, { min: 100000 });
  assert.deepEqual(body.similarwebGrowth, { max: -0.01 });
  assert.equal(body.visitorCountry, 'US');
  assert.equal(body.createdAfter, '2026-06-01T00:00:00.000Z');
});

// ---------- ad-count fields ----------
// db_num_ads is never null and is 45% non-zero; max_ads_7d is null 43% of the
// time, which is NOT a measured zero and must not render as "0".
const mapAdCounts = (b) => ({
  metaAds: Number(b.db_num_ads) || Number(b.library_num_ads) || Number(b.num_ads_running) || 0,
  maxAds7d: b.max_ads_7d == null ? null : Number(b.max_ads_7d),
});

test('ad count prefers the populated db_num_ads field', () => {
  assert.equal(mapAdCounts({ db_num_ads: 659, library_num_ads: 65 }).metaAds, 659);
  assert.equal(mapAdCounts({ db_num_ads: 85, library_num_ads: 0 }).metaAds, 85);
  assert.equal(mapAdCounts({ db_num_ads: 0, library_num_ads: 12 }).metaAds, 12);
});

test('an uncomputed peak stays null and is not reported as zero', () => {
  assert.equal(mapAdCounts({ max_ads_7d: null }).maxAds7d, null);
  assert.equal(mapAdCounts({ max_ads_7d: 0 }).maxAds7d, 0);
  assert.equal(mapAdCounts({ max_ads_7d: 246 }).maxAds7d, 246);
});

// ---------- SimilarWeb vs the index's own estimate ----------
// Mirrors mapBrand(): sw_visits is SimilarWeb measured for THIS exact host and
// wins whenever it exists; monthly_traffic is the index's estimate — often the
// PARENT domain's traffic (store.nytimes.com was filed with nytimes.com's 178M
// visits) — and survives only as a fallback that every surface labels via
// trafficSource. Nothing is ever mixed silently, and nothing is invented.
function mapTraffic(b) {
  const sw = Number(b.sw_visits);
  const measured = Number.isFinite(sw) && sw > 0;
  const monthly = Number(b.monthly_traffic) || 0;
  const growthPct = b.sw_growth_pct == null || b.sw_growth_pct === ''
    || !Number.isFinite(Number(b.sw_growth_pct)) ? null : Number(b.sw_growth_pct);
  const globalRank = Number(b.sw_global_rank) > 0 ? Number(b.sw_global_rank) : null;
  return {
    monthlyVisits: measured ? sw : monthly,
    visitsGrowth: measured ? (growthPct ?? 0) : (Number(b.growth_rate) || 0),
    // null = nothing to show; a growth cell must not print 0% for "unknown".
    growthShown: measured ? growthPct : (Number(b.growth_rate) || 0),
    rank: measured && globalRank != null ? globalRank : (Number(b.similar_web) || 0),
    trafficSource: measured ? 'similarweb' : monthly > 0 ? 'index' : null,
  };
}

test('a measured store shows SimilarWeb, not the parent domain\'s figure', () => {
  const t = mapTraffic({
    sw_visits: 1_240_000, sw_growth_pct: -4.62, sw_global_rank: 48_120,
    monthly_traffic: 178_145_790, growth_rate: 7, similar_web: 12_100_512,
  });
  assert.equal(t.monthlyVisits, 1_240_000);
  assert.equal(t.visitsGrowth, -4.62);
  assert.equal(t.trafficSource, 'similarweb');
  // the ~12.1M sentinel is replaced by the real rank, never shown beside it
  assert.equal(t.rank, 48_120);
});

test('a store the crawl has not reached keeps the index figure, labelled', () => {
  const t = mapTraffic({ monthly_traffic: 40_218_147, growth_rate: 7, similar_web: 116 });
  assert.equal(t.monthlyVisits, 40_218_147);
  assert.equal(t.visitsGrowth, 7);
  assert.equal(t.rank, 116);
  assert.equal(t.trafficSource, 'index');
});

test('a null or zero sw_visits is absence of a measurement, not zero traffic', () => {
  for (const sw of [null, undefined, 0, '']) {
    const t = mapTraffic({ sw_visits: sw, monthly_traffic: 5_000 });
    assert.equal(t.monthlyVisits, 5_000);
    assert.equal(t.trafficSource, 'index');
  }
});

test('a store with no figure from either source reports no source at all', () => {
  const t = mapTraffic({});
  assert.equal(t.monthlyVisits, 0);
  assert.equal(t.trafficSource, null);
});

test('growth is read from the same source as the visits beside it', () => {
  const measured = mapTraffic({ sw_visits: 1_240_000, sw_growth_pct: -4.62, monthly_traffic: 178_145_790, growth_rate: 7 });
  assert.equal(measured.trafficSource, 'similarweb');
  assert.equal(measured.growthShown, -4.62);   // never the index's 7% beside a measured figure
  const fallback = mapTraffic({ monthly_traffic: 40_218_147, growth_rate: 7 });
  assert.equal(fallback.trafficSource, 'index');
  assert.equal(fallback.growthShown, 7);       // the index's own rate, labelled as such
});

test('a measured store with no earlier month shows no growth rather than 0%', () => {
  const t = mapTraffic({ sw_visits: 23_702_154, monthly_traffic: 11_737_154, growth_rate: 7 });
  assert.equal(t.growthShown, null);          // the cell collapses
  assert.notEqual(t.growthShown, 0);          // 0% would read as "flat", which is a claim
  assert.equal(t.trafficSource, 'similarweb');
});

test('a measured store SimilarWeb gives no rank to keeps the index rank', () => {
  const t = mapTraffic({ sw_visits: 9_400, sw_global_rank: 0, similar_web: 12_100_512 });
  assert.equal(t.rank, 12_100_512);           // the index's own value, which callers know is a sentinel
  assert.equal(t.monthlyVisits, 9_400);
});

// A list row carries two measured months: sw_visits in sw_period, and
// sw_prev_visits in the month before it (SimilarWeb's history is consecutive
// months ending at the measured period). With no period, neither month has a
// name and the earlier label stays empty rather than being guessed.
function previousMonth(period) {
  if (!/^\d{4}-\d{2}$/.test(period)) return '';
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
function swPair(sw) {
  if (!(sw.prevVisits > 0)) return [];
  return [{ t: previousMonth(sw.period), v: sw.prevVisits }, { t: sw.period, v: sw.visits }];
}

test('the earlier sparkline point is the calendar month before the measured one', () => {
  assert.deepEqual(swPair({ period: '2026-08', visits: 100, prevVisits: 80 }), [
    { t: '2026-07', v: 80 },
    { t: '2026-08', v: 100 },
  ]);
  // a January period steps back across the year boundary
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth(''), '');
});

test('one measured month draws no line at all', () => {
  assert.deepEqual(swPair({ period: '2026-08', visits: 100, prevVisits: 0 }), []);
});

// ---------- table column sorting ----------
const SHOP_SORTS = {
  traffic: 'sw_visits', revenue: 'estimated_sales', growth: 'sw_growth_pct',
  aov: 'avg_product_price', ads: 'db_num_ads', maxads: 'max_ads_7d',
  products: 'total_product', launched: 'store_created_at',
};
const isShopSort = v => !!v && Object.prototype.hasOwnProperty.call(SHOP_SORTS, v);

test('only whitelisted columns reach the index as a sort field', () => {
  assert.equal(isShopSort('ads'), true);
  assert.equal(isShopSort('maxads'), true);
  assert.equal(isShopSort('launched'), true);
  // a crafted value must not be passed through to Elasticsearch
  assert.equal(isShopSort('store_url'), false);
  assert.equal(isShopSort('__proto__'), false);
  assert.equal(isShopSort('constructor'), false);
  assert.equal(isShopSort(undefined), false);
});

// Mirrors queryShops(): an explicit column sort beats a segment, because a
// reader who clicks a header expects that header to take effect.
function resolveSort(qp, segments) {
  if (isShopSort(qp.sort)) {
    return { sortBy: SHOP_SORTS[qp.sort], sortOrder: qp.dir === 'asc' ? 'asc' : 'desc' };
  }
  const seg = qp.view ? segments[qp.view] : undefined;
  return seg ? { sortBy: seg.sortBy, sortOrder: seg.sortOrder } : {};
}
const SEGMENTS = {
  'ad-peak': { sortBy: 'db_num_ads', sortOrder: 'desc' },
  'newest':  { sortBy: 'store_created_at', sortOrder: 'desc' },
};

test('a clicked column overrides an active segment', () => {
  assert.deepEqual(resolveSort({ view: 'ad-peak', sort: 'launched' }, SEGMENTS),
    { sortBy: 'store_created_at', sortOrder: 'desc' });
});

test('a segment applies when no column is chosen', () => {
  assert.deepEqual(resolveSort({ view: 'ad-peak' }, SEGMENTS),
    { sortBy: 'db_num_ads', sortOrder: 'desc' });
});

test('direction defaults to desc and only "asc" flips it', () => {
  assert.equal(resolveSort({ sort: 'aov' }, SEGMENTS).sortOrder, 'desc');
  assert.equal(resolveSort({ sort: 'aov', dir: 'asc' }, SEGMENTS).sortOrder, 'asc');
  assert.equal(resolveSort({ sort: 'aov', dir: 'sideways' }, SEGMENTS).sortOrder, 'desc');
});

test('an unknown sort key falls back rather than breaking the query', () => {
  assert.deepEqual(resolveSort({ sort: 'nonsense' }, SEGMENTS), {});
  assert.deepEqual(resolveSort({ sort: 'nonsense', view: 'newest' }, SEGMENTS),
    { sortBy: 'store_created_at', sortOrder: 'desc' });
});

// ---------- default ordering ----------
// The shops table opens on measured traffic desc. It used to open on peak ads
// (7d) because ranking by traffic put store.nytimes.com / shop.weather.com /
// shop.bbc.com on top — but that was the index filing each subdomain under its
// PARENT domain's traffic, not a fact about those storefronts. SimilarWeb
// measures the exact host, so the reason is gone.
const DEFAULT_SORT = 'traffic';
const DEFAULT_DIR = 'desc';

function resolveSortWithDefault(qp, segments) {
  if (isShopSort(qp.sort)) {
    return { sortBy: SHOP_SORTS[qp.sort], sortOrder: qp.dir === 'asc' ? 'asc' : 'desc' };
  }
  const seg = qp.view ? segments[qp.view] : undefined;
  if (seg) return { sortBy: seg.sortBy, sortOrder: seg.sortOrder };
  return { sortBy: SHOP_SORTS[DEFAULT_SORT], sortOrder: DEFAULT_DIR };
}

test('with nothing selected the table sorts by measured visits, descending', () => {
  assert.deepEqual(resolveSortWithDefault({}, SEGMENTS),
    { sortBy: 'sw_visits', sortOrder: 'desc' });
});

test('the default yields to a segment and to an explicit column', () => {
  assert.deepEqual(resolveSortWithDefault({ view: 'newest' }, SEGMENTS),
    { sortBy: 'store_created_at', sortOrder: 'desc' });
  assert.deepEqual(resolveSortWithDefault({ sort: 'maxads' }, SEGMENTS),
    { sortBy: 'max_ads_7d', sortOrder: 'desc' });
});

test('the default column can still be flipped to ascending', () => {
  assert.deepEqual(resolveSortWithDefault({ sort: 'traffic', dir: 'asc' }, SEGMENTS),
    { sortBy: 'sw_visits', sortOrder: 'asc' });
});

// The header highlights the default column only when nothing else is chosen.
const headerActive = (params, sortKey, isDefault) => {
  const explicit = params.sort ?? null;
  const hasSegment = !!params.view;
  const active = explicit ?? (hasSegment ? null : (isDefault ? sortKey : null));
  return active === sortKey;
};

test('the default header shows active with an empty URL, but not under a segment', () => {
  assert.equal(headerActive({}, 'traffic', true), true);
  assert.equal(headerActive({}, 'maxads', false), false);
  assert.equal(headerActive({ view: 'ad-peak' }, 'traffic', true), false);
  assert.equal(headerActive({ sort: 'aov' }, 'traffic', true), false);
  assert.equal(headerActive({ sort: 'aov' }, 'aov', false), true);
});

// db_num_ads and max_ads_7d are close but distinct: over 400 sampled rows, 20
// populated rows differ and the 7-day peak is always >= the current count.
test('the growth column sorts on the measured change, not the index rate', () => {
  assert.equal(SHOP_SORTS.growth, 'sw_growth_pct');
  assert.deepEqual(resolveSort({ sort: 'growth' }, SEGMENTS),
    { sortBy: 'sw_growth_pct', sortOrder: 'desc' });
});

test('ads and peak-ads are treated as separate measurements', () => {
  assert.notEqual(SHOP_SORTS.ads, SHOP_SORTS.maxads);
  assert.equal(SHOP_SORTS.ads, 'db_num_ads');
  assert.equal(SHOP_SORTS.maxads, 'max_ads_7d');
});

// ---------- creatives endpoint parameter contract ----------
// The creatives endpoint reads `search` and `selectedCountry`. It reads NO
// store parameter at all, so `storeIds` returned the entire 1.3M index and a
// shop's "ad creatives" panel showed other brands' ads. Verified live:
//   country=GB         -> 1,316,627 (whole index, countries US/BR/IN)
//   selectedCountry=GB ->    36,066 (all GB)
//   search=cheezit.com ->     2,984 (all cheezit.com)
function creativeParams(f) {
  const p = new URLSearchParams();
  const search = f.storeDomain || f.q;
  if (search) p.set('search', search);
  if (f.country) p.set('selectedCountry', f.country);
  return p;
}

test('creatives use selectedCountry, never the ignored country param', () => {
  const p = creativeParams({ country: 'GB' });
  assert.equal(p.get('selectedCountry'), 'GB');
  assert.equal(p.get('country'), null);
});

test('a store scope becomes a domain search, not a storeIds filter', () => {
  const p = creativeParams({ storeDomain: 'cheezit.com' });
  assert.equal(p.get('search'), 'cheezit.com');
  assert.equal(p.get('storeIds'), null);
});

test('an explicit store scope wins over a free-text query', () => {
  assert.equal(creativeParams({ storeDomain: 'cheezit.com', q: 'snack' }).get('search'), 'cheezit.com');
});

// `search` is free text, so results must be re-checked against the domain —
// a loose match must never be presented as this brand's ad.
const scopeToDomain = (items, domain) => items.filter(a => a.domain === domain);

test('store creatives are re-checked against the domain', () => {
  const items = [
    { id: '1', domain: 'cheezit.com' },
    { id: '2', domain: 'buy.cheezit.com' },
    { id: '3', domain: 'cheezitfan.com' },
    { id: '4', domain: 'cheezit.com' },
  ];
  assert.deepEqual(scopeToDomain(items, 'cheezit.com').map(a => a.id), ['1', '4']);
});

// ---------- brand name extraction ----------
// Store titles are page titles. The brand is the segment matching the domain,
// not the longest one — by length "Veinci | Affordable Dainty Elegant Jewelry"
// yields the tagline rather than "Veinci".
const GENERIC = /^(home|shop|store|official(\s+(site|store|website))?|welcome|index|buy online|online (shop|store))$/i;
function domainRoot(domain) {
  const l = domain.split('.').filter(Boolean);
  if (l.length < 2) return l[0] ?? '';
  let i = l.length - 2;
  if (l[i].length <= 3 && i > 0) i -= 1;
  return l[i];
}
function displayBrand(title, domain) {
  const full = String(title ?? '').trim() || domain;
  if (full === domain) return domain;
  const parts = full.split(/\s*[|–—·•]\s*|\s+-\s+/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return full;
  const meaningful = parts.filter(p => !GENERIC.test(p));
  if (!meaningful.length) return full;
  const root = domainRoot(domain).toLowerCase();
  const norm = v => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (root) {
    const hit = meaningful.find(p => { const n = norm(p); return n.length >= 3 && (root.includes(n) || n.includes(root)); });
    if (hit) return hit;
  }
  return meaningful[0];
}

test('the brand is the segment that matches the domain', () => {
  assert.equal(displayBrand('Home | Cheez-It®', 'cheezit.com'), 'Cheez-It®');
  assert.equal(displayBrand('Veinci | Affordable Dainty Elegant Jewelry', 'veinci.com'), 'Veinci');
  assert.equal(displayBrand('Smarter Sleep Starts Here | Mellow', 'mellowsleep.com'), 'Mellow');
  assert.equal(displayBrand('ParoPet | Premium Pet Care', 'paropet.co.uk'), 'ParoPet');
});

test('with no domain match the leading non-generic segment wins', () => {
  assert.equal(displayBrand('The New York Times Store | Official Apparel, Books and Gifts', 'store.nytimes.com'),
    'The New York Times Store');
  assert.equal(displayBrand('RYZE Mushroom Coffee | Official Site', 'ryzesuperfoods.com'), 'RYZE Mushroom Coffee');
});

test('single-segment and hyphenated names are left intact', () => {
  assert.equal(displayBrand('Gymshark', 'gymshark.com'), 'Gymshark');
  // "Cheez-It" must not split on its internal hyphen — only " - " separates.
  assert.equal(displayBrand('Cheez-It', 'cheezit.com'), 'Cheez-It');
});

test('a public-suffix domain resolves to the right label', () => {
  assert.equal(domainRoot('paropet.co.uk'), 'paropet');
  assert.equal(domainRoot('store.nytimes.com'), 'nytimes');
  assert.equal(domainRoot('veinci.com'), 'veinci');
});

// ---------- Chrome UX Report ranks ----------
// CrUX publishes a magnitude BAND, not a position: 1000 means "in the top 1,000
// origins". We must never interpolate an ordinal Google does not publish.
const BANDS = [1000,5000,10000,50000,100000,500000,1000000,5000000,10000000,50000000];
const LABEL = {1000:'Top 1K',5000:'Top 5K',10000:'Top 10K',50000:'Top 50K',100000:'Top 100K',
  500000:'Top 500K',1000000:'Top 1M',5000000:'Top 5M',10000000:'Top 10M',50000000:'Top 50M'};
const bandLabel = b => LABEL[b] ?? `Top ${b.toLocaleString()}`;

test('CrUX bands render as magnitudes, not invented ranks', () => {
  assert.equal(bandLabel(1000), 'Top 1K');
  assert.equal(bandLabel(100000), 'Top 100K');
  assert.equal(bandLabel(50000000), 'Top 50M');
});

// Origins normalise to a domain; http/https/www variants collapse and the BEST
// (lowest) band wins, otherwise variants of one site fight each other.
const cleanOrigin = o => {
  let d = String(o || '').trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0].split('#')[0].replace(/:\d+$/, '');
  return d.includes('.') && !d.includes(' ') ? d : '';
};

test('CrUX origins normalise to a comparable domain', () => {
  assert.equal(cleanOrigin('https://www.gymshark.com'), 'gymshark.com');
  assert.equal(cleanOrigin('http://gymshark.com/'), 'gymshark.com');
  assert.equal(cleanOrigin('https://shop.bbc.com:443'), 'shop.bbc.com');
  assert.equal(cleanOrigin('android-app://com.example'), '');
  assert.equal(cleanOrigin(''), '');
});

test('the best band wins when origins collapse to one domain', () => {
  const rows = [
    { domain: 'gymshark.com', bucket: 100000 },
    { domain: 'gymshark.com', bucket: 50000 },
    { domain: 'gymshark.com', bucket: 500000 },
  ];
  const best = new Map();
  for (const r of rows) {
    const p = best.get(r.domain);
    if (p == null || r.bucket < p) best.set(r.domain, r.bucket);
  }
  assert.equal(best.get('gymshark.com'), 50000);
});

// An unranked domain means Chrome saw too little real traffic — a real signal,
// never to be shown as rank 0 or as a missing value pretending to be good.
test('an unranked domain is null, never zero', () => {
  const ranks = new Map([['gymshark.com', 50000]]);
  assert.equal(ranks.get('gymshark.com'), 50000);
  assert.equal(ranks.get('tryorgatics.com') ?? null, null);
  assert.notEqual(ranks.get('tryorgatics.com') ?? null, 0);
});

test('band strength is monotonic so more popular never scores lower', () => {
  const strength = b => {
    const lo = Math.log10(1000), hi = Math.log10(50000000);
    return Math.max(0, Math.min(1, 1 - (Math.log10(b) - lo) / (hi - lo)));
  };
  for (let i = 1; i < BANDS.length; i++) {
    assert.ok(strength(BANDS[i - 1]) > strength(BANDS[i]),
      `${BANDS[i - 1]} should outrank ${BANDS[i]}`);
  }
  assert.equal(strength(1000), 1);
  assert.equal(strength(50000000), 0);
});

// ---------- traffic credibility against Chrome's ranking ----------
// Measured over 397 live rows, median index visits per CrUX band fall
// monotonically (Top 5K 23.1M · Top 50K 6.1M · Top 500K 445K · Top 1M 75K), so
// the index is directionally sound. The tails are not: 26 of those rows sit in
// Chrome's top 1M while reporting under 5,000 visits. Floors sit well below each
// band's median so only clear contradictions trip.
const FLOOR = { 1000:100000, 5000:100000, 10000:100000, 50000:50000, 100000:25000, 500000:5000, 1000000:2000 };
const trafficIsCredible = (visits, bucket) => {
  if (!visits || visits <= 0) return false;
  if (bucket == null) return true;
  const f = FLOOR[bucket];
  return f == null ? true : visits >= f;
};

test('a top-ranked domain reporting a trivial visit count is rejected', () => {
  assert.equal(trafficIsCredible(483, 500000), false);      // tryorgatics.com
  assert.equal(trafficIsCredible(274, 1000000), false);     // shopeverly.shop
  assert.equal(trafficIsCredible(4207, 100000), false);     // lymphoria.co
});

test('plausible figures for the same bands are kept', () => {
  assert.equal(trafficIsCredible(445000, 500000), true);
  assert.equal(trafficIsCredible(74500, 1000000), true);
  assert.equal(trafficIsCredible(6124341, 50000), true);
});

test('a genuinely small store outside the ranked bands is not flagged', () => {
  // Beyond the top 1M there is no floor: low traffic there is expected.
  assert.equal(trafficIsCredible(119, 5000000), true);
  assert.equal(trafficIsCredible(77, 10000000), true);
});

test('an unranked domain has nothing to contradict', () => {
  assert.equal(trafficIsCredible(500, null), true);
  assert.equal(trafficIsCredible(0, null), false);   // still nothing to show
});

test('the floors never exceed the measured median for their band', () => {
  const MEASURED_MEDIAN = { 5000:23085612, 10000:14845780, 50000:6124341, 100000:5306641, 500000:444714, 1000000:74546 };
  for (const [band, median] of Object.entries(MEASURED_MEDIAN)) {
    assert.ok(FLOOR[band] < median,
      `floor ${FLOOR[band]} for band ${band} must sit below the measured median ${median}`);
  }
});

// ---------- SimilarWeb sentinel ranks ----------
// Rows SimilarWeb could not rank carry a sentinel around 12.1M instead of a real
// position. Measured on a live top-traffic page, ALL 15 such rows were subdomain
// storefronts that had inherited their parent's traffic: store.nytimes.com
// reports 178,145,790 visits — nytimes.com's whole site, not the merch store.
const rankIsSentinel = r => r >= 12_000_000 && r <= 12_300_000;

test('the SimilarWeb sentinel band is recognised', () => {
  assert.equal(rankIsSentinel(12_115_535), true);   // store.nytimes.com
  assert.equal(rankIsSentinel(12_115_830), true);   // shop.hulu.com
  assert.equal(rankIsSentinel(12_197_531), true);   // upper edge seen live
  assert.equal(rankIsSentinel(287), false);         // gymshark.com, a real rank
  assert.equal(rankIsSentinel(3_063_272), false);   // lynae.co, a real rank
  assert.equal(rankIsSentinel(0), false);
});

const credible = (visits, bucket, rank = 0) => {
  if (!visits || visits <= 0) return false;
  if (rankIsSentinel(rank)) return false;
  if (bucket == null) return true;
  const f = FLOOR[bucket];
  return f == null ? true : visits >= f;
};

test('a subdomain storefront never shows its parent domain traffic', () => {
  // store.nytimes.com: huge visits, plausible-looking band, sentinel rank.
  assert.equal(credible(178_145_790, 1_000_000, 12_115_535), false);
  assert.equal(credible(22_704_816, 1_000_000, 12_115_830), false);   // shop.hulu.com
  assert.equal(credible(5_306_641, 100_000, 12_115_671), false);      // uk.gymshark.com
});

test('a real rank on the same numbers is still trusted', () => {
  assert.equal(credible(8_437_710, 50_000, 287), true);               // gymshark.com
  assert.equal(credible(1_005_791, 500_000, 254_819), true);          // gruns.co
});

// ---------- category ranking: full-index counts, not a shop sample ----------
// Mirrors categoryRanking() in lib/market/shops.ts, and categoryAdRanking() in
// lib/data.ts. The rankings must use the server-side brand_count/creative_count
// aggregates over the whole index — never a top-100 shop sample. The three
// behaviours that would be wrong if someone changed this later:
//   1. only level-0 (top-level) categories compete,
//   2. duplicate category names resolve to the richest row (legacy taxonomy),
//   3. ranking sorts by creative_count descending, and only categories with
//      creative_count > 0 are reported.
function categoryRanking(rows) {
  const best = new Map();
  for (const c of rows) {
    if (c.level !== 0) continue;
    const prev = best.get(c.name);
    if (!prev || c.brand_count > prev.brand_count) best.set(c.name, c);
  }
  return [...best.values()]
    .map(c => ({ category: c.name, shops: c.brand_count, creativeCount: c.creative_count }))
    .sort((a, b) => b.creativeCount - a.creativeCount);
}

function categoryAdRanking(rows, limit = 50) {
  return categoryRanking(rows)
    .filter(r => r.creativeCount > 0)
    .slice(0, limit)
    .map(r => ({ category: r.category, shops: r.shops, liveAds: r.creativeCount }));
}

test('category ranking covers the full index, not a 100-row sample', () => {
  // Two Apparel rows with the real full-index counts (7.7M stores, 278K ads).
  const rows = [
    { name: 'Apparel', level: 0, brand_count: 7_724_538, creative_count: 278_470 },
    { name: 'Health', level: 0, brand_count: 2_298_210, creative_count: 189_403 },
  ];
  const rank = categoryRanking(rows);
  assert.equal(rank[0].category, 'Apparel');
  // The shop count is the full index count, not a sample size like "32".
  assert.equal(rank[0].shops, 7_724_538);
  assert.equal(rank[0].creativeCount, 278_470);
});

test('category ranking ignores non-top-level (child) categories', () => {
  const rows = [
    { name: 'Apparel', level: 0, brand_count: 7_724_538, creative_count: 278_470 },
    // A child row with a huge count must not be conflated with a top-level one.
    { name: 'Active Wear', level: 1, brand_count: 9_000_000, creative_count: 999_999 },
  ];
  const rank = categoryRanking(rows);
  assert.deepEqual(rank.map(r => r.category), ['Apparel']);
});

test('duplicate category names resolve to the richest row, not the first', () => {
  // Legacy taxonomy shadows the modern one: id 1 "Computers" (729,825) and
  // id 4074 "Computers" (1,373,079). The richer row must win even if it sorts
  // last in the input.
  const rows = [
    { name: 'Computers', level: 0, brand_count: 1_373_079, creative_count: 38_052 }, // legacy-shadowing richer
    { name: 'Computers', level: 0, brand_count: 729_825, creative_count: 0 },        // legacy, fewer brands
    { name: 'Toys & Hobbies', level: 0, brand_count: 1_037_166, creative_count: 55_530 },
  ];
  const rank = categoryRanking(rows);
  const comp = rank.find(r => r.category === 'Computers');
  // The richest row (id 4074) supplies both the shop and creative counts.
  assert.equal(comp.shops, 1_373_079);
  assert.equal(comp.creativeCount, 38_052);
});

test('category ranking sorts by creative count, not shop count or input order', () => {
  const rows = [
    { name: 'Fewer Ads', level: 0, brand_count: 9_000_000, creative_count: 30 },
    { name: 'More Ads', level: 0, brand_count: 1_000, creative_count: 200 },
  ];
  const rank = categoryRanking(rows);
  assert.deepEqual(rank.map(r => r.category), ['More Ads', 'Fewer Ads']);
});

test('categories with no ads are omitted from the trending ranking', () => {
  const rows = [
    { name: 'Apparel', level: 0, brand_count: 7_724_538, creative_count: 278_470 },
    { name: 'Travel', level: 0, brand_count: 968_609, creative_count: 0 },
  ];
  const ads = categoryAdRanking(rows);
  assert.deepEqual(ads, [{ category: 'Apparel', shops: 7_724_538, liveAds: 278_470 }]);
});

test('categoryAdRanking respects the requested limit', () => {
  const rows = [
    { name: 'A', level: 0, brand_count: 1, creative_count: 3 },
    { name: 'B', level: 0, brand_count: 1, creative_count: 2 },
    { name: 'C', level: 0, brand_count: 1, creative_count: 1 },
  ];
  assert.equal(categoryAdRanking(rows, 2).length, 2);
});

test('categoryAdRanking maps creativeCount to liveAds without inventing a visits field', () => {
  const rows = [{ name: 'Apparel', level: 0, brand_count: 7_724_538, creative_count: 278_470 }];
  const [row] = categoryAdRanking(rows);
  // liveAds is the real creative count; there is no per-category visits number.
  assert.deepEqual(Object.keys(row).sort(), ['category', 'liveAds', 'shops']);
});

// ---------- AI creative labels: absent means absent ----------
// Imports the real mapper (lib/market/labels.ts has no bundler-only imports,
// and Node 22.18+ strips TypeScript types natively).
import { mapAiLabels, mapLabelFacets, setLabelParams, cleanLabelValues, shareOf } from '../lib/market/labels.ts';

test('ai_labels null, missing or malformed maps to null', () => {
  assert.equal(mapAiLabels(null), null);
  assert.equal(mapAiLabels(undefined), null);
  assert.equal(mapAiLabels('pain_point'), null);
  assert.equal(mapAiLabels([]), null);
  // An object with no confident label is the same as no labels.
  assert.equal(mapAiLabels({ model: 'jev-1.13.0', labeled_at: '2026-09-19T10:00:00Z' }), null);
});

test('only the keys the model was confident about are mapped', () => {
  const l = mapAiLabels({
    hook: { value: 'pain_point', label: 'Pain point', confidence: 0.81 },
    funnel_stage: { value: 'conversion', label: 'Conversion', confidence: 0.66 },
    urgency: { value: true, probability: 0.93 },
    model: 'jev-1.13.0', labeled_at: '2026-09-19T10:00:00Z',
  });
  assert.deepEqual(l, {
    hook: { value: 'pain_point', label: 'Pain point', confidence: 0.81 },
    funnelStage: { value: 'conversion', label: 'Conversion', confidence: 0.66 },
    urgency: { probability: 0.93 },
    model: 'jev-1.13.0', labeledAt: '2026-09-19T10:00:00Z',
  });
  assert.equal('angle' in l, false);
  assert.equal('offer' in l, false);
});

test('a label without a display string or a valid confidence is dropped, not guessed', () => {
  const l = mapAiLabels({
    hook: { value: 'pain_point', confidence: 0.8 },                    // no label
    angle: { value: 'quality', label: 'Quality & craft' },              // no confidence
    offer: { value: 'bundle', label: 'Bundle', confidence: 1.7 },       // out of range
    urgency: { value: false, probability: 0.2 },                        // not urgent
  });
  assert.equal(l, null);
});

test('label facets drop zero counts and a malformed payload is null', () => {
  const f = mapLabelFacets({ total: 100, labeled: 40, facets: {
    hook: [{ value: 'benefit', label: 'Benefit', description: 'd', count: 5 },
           { value: 'story', label: 'Story', description: 'd', count: 0 },
           { value: 'pain_point', label: 'Pain point', description: 'd', count: 20 }],
    urgency: [{ value: true, label: 'Urgency', description: 'd', count: 7 }],
  } });
  assert.deepEqual(f.facets.hook.map(e => e.value), ['pain_point', 'benefit']);
  assert.deepEqual(f.facets.angle, []);
  assert.equal(f.facets.urgency[0].value, 'true');
  assert.equal(mapLabelFacets({ facets: {} }), null);
  assert.equal(mapLabelFacets(null), null);
  assert.equal(shareOf(20, 40), 50);
  assert.equal(shareOf(5, 0), 0);
});

test('label filters use the API param names and reject values outside the taxonomy', () => {
  const p = new URLSearchParams();
  setLabelParams(p, { hook: ['pain_point', 'benefit'], funnelStage: ['nonsense'], offer: 'bundle,<script>', urgency: true });
  assert.equal(p.get('hook'), 'pain_point,benefit');
  assert.equal(p.get('funnelStage'), null);
  assert.equal(p.get('offer'), 'bundle');
  assert.equal(p.get('urgency'), 'true');
  assert.equal(cleanLabelValues('angle', ''), undefined);
});

// A signed-out visit to a guarded page must come back to that page after sign-in,
// and the round trip must never become an open redirect.
import { loginUrl } from '../lib/auth/safe-next.ts';
test('loginUrl carries only safe same-origin return paths', () => {
  assert.equal(loginUrl('/settings/account'), '/login?next=%2Fsettings%2Faccount');
  assert.equal(loginUrl('/shops?sort=revenue'), '/login?next=%2Fshops%3Fsort%3Drevenue');
  for (const bad of [null, undefined, '', '/', '//evil.com', '/\\evil.com', 'https://evil.com']) assert.equal(loginUrl(bad), '/login');
});

test('a new workspace defaults to "<first name>\'s team"', async () => {
  const { defaultWorkspaceName } = await import('../lib/utils.ts');
  assert.equal(defaultWorkspaceName('Jane Doe', 'j@x.com'), "Jane's team");
  assert.equal(defaultWorkspaceName('  ', 'sam.lee@x.com'), "sam.lee's team");
  assert.equal(defaultWorkspaceName(null, 'kim@x.com'), "kim's team");
});
