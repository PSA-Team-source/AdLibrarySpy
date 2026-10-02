#!/usr/bin/env node
// The Monday report: builds this ISO week's report from the market index,
// publishes it at /weekly/{week}, writes a ready-to-post X thread into it and
// mails it to newsletter subscribers who opted in. Run from cron (Monday).
//
//   node scripts/weekly-report.mjs              generate (once per week) + publish + mail
//   node scripts/weekly-report.mjs --dry-run    build from live data, print JSON, touch nothing
//   node scripts/weekly-report.mjs --no-email   generate + publish only
//   node scripts/weekly-report.mjs --week=2026-w40
//
// Idempotent per ISO week: the report row is written once and frozen (what was
// published is what was mailed); re-runs only resume mailing subscribers the
// week has no send row for. A run that cannot build a real report exits 1
// without writing anything.
//
// Every figure is copied from the index with its source and period. Nothing is
// modelled, and a store without the measurement a section ranks on is not in it.
import pg from 'pg';
import crypto from 'node:crypto';
import { isoWeekOf, weekBounds } from '../lib/weekly/week.ts';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const NO_EMAIL = argv.includes('--no-email');
const weekArg = argv.find(a => a.startsWith('--week='))?.slice(7);

const {
  DATABASE_URL, MARKET_API_BASE = 'http://127.0.0.1:5900/api/v1',
  PLATFORM_JWT_SECRET, MARKET_SERVICE_ACCOUNT_ID,
  APP_BASE_URL = 'https://adlibraryspy.com',
  WEEKLY_MAIL_PER_SEC = '4',
} = process.env;
const APP = APP_BASE_URL.replace(/\/$/, '');

if (!DRY && !DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
if (!PLATFORM_JWT_SECRET || !MARKET_SERVICE_ACCOUNT_ID) {
  console.error('PLATFORM_JWT_SECRET / MARKET_SERVICE_ACCOUNT_ID not set (the range filter endpoint is JWT-gated)');
  process.exit(1);
}

// ---------- ISO week ----------
let wk;
if (weekArg) {
  const m = /^(\d{4})-w(\d{2})$/.exec(weekArg);
  if (!m || +m[2] < 1 || +m[2] > 53) { console.error(`--week must look like 2026-w40, got ${weekArg}`); process.exit(1); }
  wk = { year: +m[1], week: +m[2], key: weekArg };
} else {
  wk = isoWeekOf(new Date());
}
const WEEK = wk.key;
const bounds = weekBounds(wk.year, wk.week);

// ---------- market API ----------
const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function serviceToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    id: MARKET_SERVICE_ACCOUNT_ID, email: 'service@marketlens.internal',
    name: 'AdLibrarySpy Service', app: 'marketlens', googleId: '', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createHmac('sha256', PLATFORM_JWT_SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}
const TOKEN = serviceToken();

async function market(path, body) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${MARKET_API_BASE}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return await res.json();
      last = new Error(`${path} -> ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;     // our bug; retrying will not help
    } catch (err) { last = err; }
    await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
  }
  throw last;
}
const itemsOf = p => { const d = p?.data ?? p; return Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []; };

/** POST /top-brands/filter — the same body shape lib/market/shops.ts rangeBody() sends. */
const brands = (body) => market('/top-brands/filter', { platforms: ['shopify'], page: 1, limit: 100, ...body }).then(itemsOf);

// ---------- field mapping (mirrors lib/market/shops.ts mapBrand) ----------
const cleanDomain = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const CRAWL_ARTIFACT = /^\s*\d{3}\s+(moved|found|not found|forbidden|bad gateway|service unavailable|internal server error|unauthorized|gone)\b|moved permanently|moved temporarily|^not found$|^forbidden$|bad gateway|service unavailable|access denied|just a moment|attention required|are you a robot|checking your browser|enable javascript|^error$/i;
const GENERIC = /^(home|shop|store|official(\s+(site|store|website))?|welcome|index|buy online|online (shop|store))$/i;

// ponytail: copy of displayBrand() in lib/market/shops.ts (that file imports
// '@/' aliases a plain node script cannot resolve). Keep the two in step.
function brandName(title, domain) {
  const t = String(title ?? '').trim();
  if (!t || CRAWL_ARTIFACT.test(t)) return domain;
  const parts = t.split(/\s*[|–—·•:]\s*|\s+-\s+/).map(p => p.trim()).filter(p => p && !GENERIC.test(p));
  if (!parts.length) return domain;
  const labels = domain.split('.');
  let i = labels.length - 2; if (i > 0 && labels[i].length <= 3) i -= 1;
  const root = (labels[Math.max(0, i)] || '').toLowerCase();
  const norm = v => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = parts.find(p => { const n = norm(p); return n.length >= 3 && (root.includes(n) || n.includes(root)); });
  return (hit || parts[0]).slice(0, 60);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = p => { const m = /^(\d{4})-?(\d{2})/.exec(String(p || '')); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
const compact = n => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
};
const pct = n => `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString('en-US')}%`;
const CCY = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', SE: 'SEK', BR: 'BRL', MX: 'MXN', JP: 'JPY', IN: 'INR' };

let CATS = {};
function base(b) {
  const domain = cleanDomain(b.store_url);
  const logo = String(b.store_logo || '');
  return {
    domain,
    name: brandName(b.store_title, domain),
    logo: /^https:\/\//.test(logo) ? logo : '',
    country: String(b.country || '').toUpperCase(),
    niche: CATS[String(b.store_category_id)] || '',
  };
}
const visitsOf = b => num(b.sw_visits);
const periodOf = b => monthLabel(b.sw_period);
const trafficNote = b => visitsOf(b) ? `${compact(visitsOf(b))} visits in ${periodOf(b)} (SimilarWeb)` : '';

// A store appears once per report, in the first section that picks it.
const used = new Set();
function pick(rows, keep, map, n = 10) {
  const out = [];
  for (const b of rows) {
    const d = cleanDomain(b.store_url);
    if (!d || !d.includes('.') || used.has(d) || !keep(b)) continue;
    used.add(d);
    out.push({ raw: b, item: { ...base(b), ...map(b) } });
    if (out.length >= n) break;
  }
  return out;
}

// ---------- build ----------
async function build() {
  // Category names (one call, cached server-side). Empty is tolerated: the
  // niche label is then simply absent.
  const catRows = itemsOf(await market('/market/store-categories?all=true').catch(() => ({ data: [] })));
  for (const c of catRows) if (c?.id != null && c?.name) CATS[String(c.id)] = String(c.name).trim();

  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [scalingRows, growthRows, peakRows, newRows] = await Promise.all([
    // Biggest jump in active Meta ads among stores with real, measured traffic.
    brands({ sort: { field: 'num_ads_increase', order: 'desc' }, similarwebVisits: { min: 20_000 }, numAdsIncrease: { min: 10 } }),
    // Measured month-over-month traffic growth. The floor keeps it to stores
    // whose growth is a business moving, not 40 visits becoming 4,000.
    brands({ sort: { field: 'sw_growth_pct', order: 'desc' }, similarwebVisits: { min: 100_000 }, similarwebGrowth: { max: 2_000 } }),
    brands({ sort: { field: 'max_ads_7d', order: 'desc' }, similarwebVisits: { min: 10_000 } }),
    brands({ sort: { field: 'sw_visits', order: 'desc' }, createdAfter: since90, similarwebVisits: { min: 5_000 } }),
  ]);

  const indexMonth = (() => {
    const my = String([...scalingRows, ...growthRows, ...peakRows][0]?.month_year || '');
    if (/^20\d{4}$/.test(my)) return `${my.slice(0, 4)}-${my.slice(4)}`;    // 202609 -> 2026-09
    return /^\d{2}20\d{2}$/.test(my) ? `${my.slice(2)}-${my.slice(0, 2)}` : '';   // 092026 -> 2026-09
  })();
  const trafficPeriod = String(growthRows.find(b => b.sw_period)?.sw_period || '').slice(0, 7);

  // num_ads_increase is the index's change in the Meta Ad Library's running-ad
  // count (num_ads_running); the two are shown together so the jump has its base.
  const scaling = pick(scalingRows, b => num(b.num_ads_increase) > 0 && num(b.num_ads_running) > 0, b => {
    const p = num(b.percentage_num_ads_increase);
    return {
      metric: `+${num(b.num_ads_increase).toLocaleString('en-US')} ads`,
      value: num(b.num_ads_increase),
      detail: [`${num(b.num_ads_running).toLocaleString('en-US')} ads running in the Meta Ad Library${p > 0 && p < 1000 ? ` (${pct(p)})` : ''}`, trafficNote(b)].filter(Boolean).join(' · '),
    };
  });

  const growth = pick(growthRows, b => num(b.sw_prev_visits) >= 20_000 && b.sw_growth_pct != null && num(b.sw_growth_pct) > 0, b => ({
    metric: pct(num(b.sw_growth_pct)),
    value: num(b.sw_growth_pct),
    detail: `${compact(num(b.sw_prev_visits))} → ${compact(visitsOf(b))} visits, ${monthLabel(prevMonth(b.sw_period))} → ${periodOf(b)} (SimilarWeb)`,
  }));

  const peaks = pick(peakRows, b => num(b.max_ads_7d) > 0, b => {
    const date = dayOf(b.max_ads_7d_date);
    return {
      metric: `${compact(num(b.max_ads_7d))} ads`,
      value: num(b.max_ads_7d),
      detail: [`Peak of ${num(b.max_ads_7d).toLocaleString('en-US')} active Meta ads in 7 days${date ? ` (recorded ${date})` : ''}`, trafficNote(b)].filter(Boolean).join(' · '),
    };
  });

  const newest = pick(newRows, b => visitsOf(b) > 0 && num(b.store_created_at) > 0, b => {
    const launched = new Date(num(b.store_created_at)).toISOString().slice(0, 10);
    return {
      metric: `${compact(visitsOf(b))} visits`,
      value: visitsOf(b),
      detail: `Store created ${launched} · ${compact(visitsOf(b))} visits in ${periodOf(b)} (SimilarWeb)`,
    };
  });

  // Per-niche movers: the fastest measured grower in each of the six biggest
  // top-level niches. Cheap (six filtered calls) and skipped on any failure.
  const topNiches = catRows
    .filter(c => Number(c.level ?? 0) === 0 && num(c.brand_count) > 0 && Number(c.id) >= 1000)
    .sort((a, b) => num(b.brand_count) - num(a.brand_count))
    .slice(0, 6);
  const nicheRows = await Promise.all(topNiches.map(c =>
    brands({ selectedStoreCategoryId: Number(c.id), limit: 25, sort: { field: 'sw_growth_pct', order: 'desc' }, similarwebVisits: { min: 50_000 }, similarwebGrowth: { max: 2_000 } })
      .then(rows => ({ c, rows })).catch(() => ({ c, rows: [] }))));
  const niches = [];
  for (const { c, rows } of nicheRows) {
    const [hit] = pick(rows, b => num(b.sw_prev_visits) >= 10_000 && num(b.sw_growth_pct) > 0, b => ({
      metric: pct(num(b.sw_growth_pct)),
      value: num(b.sw_growth_pct),
      detail: `Top mover in ${String(c.name).trim()} · ${compact(num(b.sw_prev_visits))} → ${compact(visitsOf(b))} visits, ${monthLabel(prevMonth(b.sw_period))} → ${periodOf(b)} (SimilarWeb)`,
    }), 1);
    if (hit) { hit.item.niche = String(c.name).trim(); niches.push(hit); }
  }

  // Products the featured stores list on their storefront (the index's
  // news_products), pictured ones only.
  const products = [];
  const seenTitles = new Set();
  for (const { raw, item } of [...scaling, ...growth, ...peaks, ...newest]) {
    for (const p of Array.isArray(raw.news_products) ? raw.news_products : []) {
      let img = String(p?.image_url ?? '');
      const title = String(p?.title ?? '').trim().slice(0, 100);
      if (!img || !title) continue;
      if (!/^https?:\/\//.test(img)) img = `https://cdn.shopify.com/s/files/${img.replace(/^\/+/, '')}`;
      if (!img.startsWith('https://')) continue;
      const k = `${item.domain}|${title.toLowerCase()}`;
      if (seenTitles.has(k)) continue;
      seenTitles.add(k);
      const price = num(p.price);
      products.push({ title, price: price > 0 ? price / 100 : 0, currency: CCY[item.country] || 'USD', image: img, domain: item.domain, storeName: item.name });
      break;                                   // one product per store keeps it varied
    }
    if (products.length >= 12) break;
  }

  const period = monthLabel(trafficPeriod);
  const sections = [
    { key: 'scaling', title: 'Top scaling stores', blurb: 'Stores adding the most ads in the Meta Ad Library, with measured traffic behind them.',
      source: `Change in running ads in the Meta Ad Library, AdLibrarySpy index (${monthLabel(indexMonth)} snapshot). Traffic: SimilarWeb, ${period}.`, items: scaling },
    { key: 'growth', title: 'Fastest traffic growth', blurb: 'Largest month-over-month jump in measured visits, among stores that already had 20K+ visits.',
      source: `SimilarWeb measured visits, ${monthLabel(prevMonth(trafficPeriod))} → ${period}.`, items: growth },
    { key: 'ad-peaks', title: 'Biggest ad peaks', blurb: 'The most Meta ads a store ran at once in a 7-day window.',
      source: 'Meta Ad Library, 7-day peak of active ads as indexed by AdLibrarySpy.', items: peaks },
    { key: 'newest', title: 'Newest winners', blurb: 'Stores created in the last 90 days that already draw real, measured traffic.',
      source: `Store creation date from the index; visits measured by SimilarWeb, ${period}.`, items: newest },
    { key: 'niches', title: 'Movers by niche', blurb: 'The fastest-growing store in each of the largest niches.',
      source: `SimilarWeb measured visits, ${period}; niche from the store's category in the index.`, items: niches },
  ].map(s => ({ ...s, items: s.items.map(x => x.item) })).filter(s => s.items.length);

  // Quality gate: the four core sections must be real lists, or nothing ships.
  for (const key of ['scaling', 'growth', 'ad-peaks', 'newest']) {
    const s = sections.find(x => x.key === key);
    if (!s || s.items.length < 5) throw new Error(`section ${key} has ${s?.items.length ?? 0} rows (<5) — index incomplete, not publishing`);
  }

  const data = {
    week: WEEK,
    weekLabel: `Week ${wk.week}, ${wk.year}`,
    weekStart: bounds.start,
    weekEnd: bounds.end,
    generatedAt: new Date().toISOString(),
    indexMonth,
    trafficPeriod,
    sections,
    products,
  };
  data.x_thread = xThread(data);
  return data;
}

/** max_ads_7d_date arrives as days since epoch (20716) or an ISO date. */
function dayOf(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 10_000 && n < 100_000) return new Date(n * 86_400_000).toISOString().slice(0, 10);
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function prevMonth(p) {
  const m = /^(\d{4})-?(\d{2})/.exec(String(p || ''));
  if (!m) return '';
  const y = +m[1], mo = +m[2];
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

// ---------- X thread ----------
// Tweets are checked against 280 raw characters (X counts a link as 23, so the
// real count is lower). Links carry ?ref=x:<week> for attribution.
function xThread(data) {
  const ref = `ref=x:${data.week}`;
  const reportUrl = `${APP}/weekly/${data.week}?${ref}`;
  const fit = t => (t.length <= 280 ? t : `${t.slice(0, 279).replace(/\s+\S*$/, '')}…`);
  const tweets = [];
  const top = data.sections.find(s => s.key === 'scaling')?.items[0];
  tweets.push(fit(`The ${data.weekLabel} ecommerce report, straight from our index of Shopify stores and Meta ads.\n\n`
    + `${top ? `This week's top scaler: ${top.name} (${top.metric} on Meta).\n\n` : ''}What's scaling, growing and launching 🧵`));
  const emoji = { scaling: '📈', growth: '🚀', 'ad-peaks': '🔥', newest: '💎', niches: '🧭' };
  for (const s of data.sections) {
    if (s.key === 'niches') continue;
    const lines = s.items.slice(0, 3).map((it, i) => `${i + 1}. ${it.domain} — ${it.metric}`);
    tweets.push(fit(`${emoji[s.key] || '•'} ${s.title}\n\n${lines.join('\n')}\n\n${APP}/store/${s.items[0].domain}?${ref}`));
  }
  tweets.push(fit(`Full report with every store, product and source:\n${reportUrl}\n\nGet it every Monday — free, no card: ${APP}/signup?${ref}`));
  return tweets;
}

// ---------- email ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emailBody(data) {
  const ref = `ref=weekly:${data.week}`;
  const parts = [`<p style="margin:0 0 16px">What moved in the index this week — every figure links to the store's live page.</p>`];
  for (const s of data.sections) {
    parts.push(`<p style="margin:20px 0 6px;font-weight:600;color:#111827">${esc(s.title)}</p>`);
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">');
    for (const it of s.items.slice(0, 5)) {
      parts.push(`<tr><td style="padding:5px 0;border-bottom:1px solid #f3f4f6"><a href="${APP}/store/${encodeURIComponent(it.domain)}?${ref}" style="color:#4338ca;text-decoration:none;font-weight:600">${esc(it.name)}</a>`
        + `<br><span style="color:#6b7280;font-size:12px">${esc(it.domain)} · ${esc(it.detail)}</span></td>`
        + `<td style="padding:5px 0 5px 12px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;font-weight:600;color:#111827">${esc(it.metric)}</td></tr>`);
    }
    parts.push('</table>');
  }
  return parts.join('');
}

async function sendAll(client, data) {
  // lib/mail.ts is the one SMTP path; Node's type stripping loads it as-is.
  const { sendMail, mailConfigured } = await import('../lib/mail.ts');
  const { unsubscribeUrl } = await import('../lib/weekly/unsubscribe.ts');
  // Every app link goes through the /r click hop; each send emits `email_sent`
  // (CTR by campaign: research/launch-2026-09/FUNNEL.md).
  const { trackLinks, clickUrl } = await import('../lib/email/click.ts');
  const { emit } = await import('../lib/analytics/events.ts');
  const campaign = `weekly:${data.week}`;
  if (!mailConfigured()) throw new Error('SMTP is not configured — report published, mail not sent');

  const body = emailBody(data);
  const gapMs = Math.max(50, Math.round(1000 / Math.max(0.1, Number(WEEKLY_MAIL_PER_SEC) || 4)));
  let sent = 0, failed = 0, streak = 0;
  for (;;) {
    const { rows } = await client.query(
      `SELECT u.id, u.email FROM newsletter_subscribers n
         JOIN users u ON u.id = n.user_id
        WHERE n.unsubscribed_at IS NULL AND u.email_verified_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM newsletter_sends s WHERE s.iso_week = $1 AND s.user_id = u.id)
        ORDER BY u.id LIMIT 200`, [WEEK]);
    if (!rows.length) break;
    let progressed = false;
    for (const r of rows) {
      // Claim first: a concurrent or repeated run can never mail this week twice.
      const claim = await client.query(
        'INSERT INTO newsletter_sends (iso_week, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING user_id', [WEEK, r.id]);
      if (!claim.rowCount) continue;
      progressed = true;
      const unsub = unsubscribeUrl(APP, r.id);
      try {
        await sendMail({
          to: r.email,
          subject: `${data.weekLabel}: the stores scaling right now`,
          heading: `The Monday report — ${data.weekLabel}`,
          body: trackLinks(body, APP, campaign, r.id),
          cta: { label: 'Read the full report', href: clickUrl(APP, `${APP}/weekly/${data.week}?ref=weekly:${data.week}`, campaign, r.id) },
          footer: `You get this because you turned on the weekly report in AdLibrarySpy settings. <a href="${unsub}" style="color:#6b7280">Unsubscribe</a>.`,
          headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        sent++; streak = 0;
        await emit('email_sent', r.id, { ref: campaign });
      } catch (err) {
        failed++; streak++;
        await client.query('DELETE FROM newsletter_sends WHERE iso_week = $1 AND user_id = $2', [WEEK, r.id]);
        console.error(`[weekly] send to ${r.id} failed: ${err.message}`);
        // SMTP is down, not one bad address: stop and let the next run resume.
        if (streak >= 5) throw new Error(`5 consecutive send failures — aborting (${sent} sent)`);
      }
      await new Promise(res => setTimeout(res, gapMs));
    }
    if (!progressed) break;
  }
  return { sent, failed };
}

// ---------- main ----------
if (DRY) {
  const data = await build();
  console.log(JSON.stringify(data, null, 2));
  console.error(`[weekly] dry run ${WEEK}: ${data.sections.map(s => `${s.key}=${s.items.length}`).join(' ')} products=${data.products.length} tweets=${data.x_thread.length} (nothing written)`);
  process.exit(0);
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
let exitCode = 0;
try {
  let { rows: [row] } = await client.query('SELECT data, published_at, emailed_at FROM weekly_reports WHERE iso_week = $1', [WEEK]);
  if (!row) {
    const data = await build();
    await client.query(
      `INSERT INTO weekly_reports (iso_week, data, published_at) VALUES ($1, $2, now())
       ON CONFLICT (iso_week) DO NOTHING`, [WEEK, JSON.stringify(data)]);
    ({ rows: [row] } = await client.query('SELECT data, published_at, emailed_at FROM weekly_reports WHERE iso_week = $1', [WEEK]));
    console.log(`[weekly] ${WEEK} published: ${data.sections.map(s => `${s.key}=${s.items.length}`).join(' ')} products=${data.products.length}`);
    // The X thread is posted by hand (no X credentials); the log is where to copy it from.
    console.log(`[weekly] X thread (weekly_reports.data->'x_thread'):\n${data.x_thread.map((t, i) => `--- ${i + 1}/${data.x_thread.length}\n${t}`).join('\n')}`);
  } else {
    console.log(`[weekly] ${WEEK} already generated at ${row.published_at?.toISOString?.() ?? 'unpublished'} — resuming`);
  }

  if (NO_EMAIL || !row.published_at) {
    console.log('[weekly] mail skipped');
  } else if (row.emailed_at) {
    console.log(`[weekly] ${WEEK} already mailed at ${row.emailed_at.toISOString()}`);
  } else {
    const { sent, failed } = await sendAll(client, row.data);
    console.log(`[weekly] mail: ${sent} sent, ${failed} failed`);
    if (failed) exitCode = 1;
    else await client.query('UPDATE weekly_reports SET emailed_at = now() WHERE iso_week = $1', [WEEK]);
  }
} catch (err) {
  console.error(`[weekly] ${WEEK} failed: ${err.message}`);
  exitCode = 1;
} finally {
  await client.end();
}
process.exit(exitCode);
