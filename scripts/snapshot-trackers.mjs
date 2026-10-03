#!/usr/bin/env node
// Records one metrics snapshot per tracked brand. Run from cron (daily).
// The brandtracker change feed is the diff of consecutive snapshots, so this
// job is what makes that feed real rather than simulated.
import pg from 'pg';
import crypto from 'node:crypto';

const {
  DATABASE_URL, MARKET_API_BASE = 'http://127.0.0.1:5900/api/v1',
  PLATFORM_JWT_SECRET, MARKET_SERVICE_ACCOUNT_ID,
} = process.env;

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function serviceToken() {
  if (!PLATFORM_JWT_SECRET || !MARKET_SERVICE_ACCOUNT_ID) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    id: MARKET_SERVICE_ACCOUNT_ID, email: 'service@marketlens.internal',
    name: 'AdLibrarySpy Service', app: 'marketlens', googleId: '', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createHmac('sha256', PLATFORM_JWT_SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

const clean = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

async function fetchBrand(storeId, domain) {
  // Look the brand up by domain in the index; store_id is the stable key.
  // The parameter is `searchQuery`: GET /top-brands ignores an unknown one
  // silently, so `search=` searched nothing and this scanned the first 100 rows
  // of the default ordering instead (see tests/unit.test.mjs).
  const res = await fetch(`${MARKET_API_BASE}/top-brands?limit=100&searchQuery=${encodeURIComponent(domain)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const d = payload?.data ?? payload;
  const items = Array.isArray(d) ? d : (d?.items ?? []);
  return items.find(b => String(b.store_id) === storeId || clean(b.store_url) === domain) ?? null;
}

// How many creatives our ad library holds for the domain — the Brandtracker's
// "New Ads" is this count's growth over the chosen window. Same request as
// creativeCountFor() in lib/market/creatives.ts. null = could not be asked; the
// snapshot then records no figure rather than a zero it cannot stand behind.
async function fetchCreativeCount(domain) {
  const token = serviceToken();
  if (!token) return null;
  try {
    const res = await fetch(`${MARKET_API_BASE}/adlibs/findproduct/creatives-es/all?limit=1&storeDomain=${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const d = payload?.data ?? payload;
    for (const src of [d?.pagination, d]) {
      for (const k of ['total', 'totalCount', 'total_count', 'count']) {
        if (src && typeof src[k] === 'number' && Number.isFinite(src[k])) return src[k];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// How many landing pages (pages its ads send people to) the index holds for the
// domain; growth = new landing pages in the tracked-shop alerts. Same request as
// listLandingPages() in lib/market/landing-pages.ts. null = could not be asked
// (or the list is still being built, 503) — no figure rather than a fake zero.
async function fetchLandingPageCount(domain) {
  const token = serviceToken();
  if (!token) return null;
  try {
    const res = await fetch(`${MARKET_API_BASE}/market/landing-pages?limit=1&store=${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const total = (await res.json())?.data?.pagination?.total;
    return typeof total === 'number' && Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: trackers } = await client.query('SELECT id, shop_id, domain FROM trackers');
console.log(`[snapshot] ${trackers.length} tracked brand(s)`);

let ok = 0, missed = 0;
for (const t of trackers) {
  try {
    const storeId = t.shop_id.startsWith('shp_') ? t.shop_id.slice(4) : t.shop_id;
    const brand = await fetchBrand(storeId, t.domain);
    if (!brand) { missed++; console.warn(`[snapshot] no index row for ${t.domain}`); continue; }

    // SimilarWeb measured this exact host, or the index's own estimate stands in.
    // The source is recorded with the figure so the change feed can tell a store
    // the crawl reached from a store whose traffic actually moved.
    const swVisits = Number(brand.sw_visits) || 0;
    const indexVisits = Number(brand.monthly_traffic) || 0;
    const metrics = {
      monthlyVisits: swVisits || indexVisits,
      monthlyVisitsSource: swVisits ? 'similarweb' : indexVisits ? 'index' : null,
      liveAds: Number(brand.db_num_ads) || Number(brand.library_num_ads) || Number(brand.num_ads_running) || 0,
      productCount: Number(brand.total_product) || 0,
      followers: Number(brand.fan_page_like) || 0,
      avgPrice: (Number(brand.avg_product_price) || 0) / 100,
      creatives: await fetchCreativeCount(clean(brand.store_url) || t.domain),
      landingPages: await fetchLandingPageCount(clean(brand.store_url) || t.domain),
    };

    // Skip a snapshot identical to the previous one — it adds no information
    // and would otherwise bloat the table with duplicate rows.
    const { rows: prev } = await client.query(
      'SELECT metrics FROM tracker_snapshots WHERE tracker_id = $1 ORDER BY captured_at DESC LIMIT 1',
      [t.id],
    );
    if (prev.length && JSON.stringify(prev[0].metrics) === JSON.stringify(metrics)) { ok++; continue; }

    await client.query('INSERT INTO tracker_snapshots (tracker_id, metrics) VALUES ($1,$2)', [t.id, JSON.stringify(metrics)]);
    ok++;
  } catch (err) {
    missed++;
    console.error(`[snapshot] ${t.domain} failed:`, err.message);
  }
}

// Housekeeping: expired sessions, consumed tokens, stale rate-limit windows.
await client.query("DELETE FROM sessions WHERE expires_at < now() - interval '7 days'");
await client.query("DELETE FROM user_tokens WHERE expires_at < now() - interval '7 days'");
await client.query("DELETE FROM oauth_codes WHERE expires_at < now() - interval '1 day'");
await client.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'");
// Recently-viewed older than 180 days no longer feeds any surface (Home shows
// the newest few, /home/history the newest 200 per user).
await client.query("DELETE FROM recent_views WHERE viewed_at < now() - interval '180 days'");

console.log(`[snapshot] done: ${ok} recorded, ${missed} missed`);
await client.end();

// A run that recorded nothing is a failure worth surfacing to the operator: a
// non-zero exit lets the cron/monitoring mark the job as failed instead of
// silently skipping every brand. An empty tracker table is a real state, not a
// fault, so it exits clean.
const failed = missed > 0 || (trackers.length > 0 && ok === 0);
if (failed) process.exit(1);
