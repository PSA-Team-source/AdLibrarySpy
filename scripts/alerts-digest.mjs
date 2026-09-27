#!/usr/bin/env node
// Alerts digest: one email per user and period with what moved in the brands
// their workspaces track, the new results of their saved searches, and "Today
// in the market" (stores whose running Meta ads jumped day over day, in the
// user's niche when known). Daily by default. Sent on the marketing envelope
// (lib/mail.ts sendMarketingMail, DTCMail IP-WARMUP.md §9), paced as steady
// traffic. Runs from cron at 13:00 UTC, plus retry runs.
//
//   node scripts/alerts-digest.mjs                 seed new alerts, then send due digests
//   node scripts/alerts-digest.mjs --dry-run       compute from live data, print, write nothing, send nothing
//        --as-monday        treat today as Monday (weekly users are due) — for dry runs
//        --only=<email>     one user only
//        --render=<dir>     with --dry-run: write each digest's HTML to <dir>
//        --send-to=<addr>   with --only: mail that user's digest to <addr>; no claim, no seen update
//        --day=YYYY-MM-DD   the market day (default: yesterday, UTC)
//
// A day with nothing personal and nothing material in the market sends that
// user nothing — never an empty digest.
//
// Reuse, not copies: tracker changes are lib/trackers.ts trackerBoard() (the
// /brandtracker board's window delta); saved searches re-run through
// app/(app)/shops/load.ts loadShops() and lib/data.ts queryAds() with the /ads
// page's adFilterFromParams(). scripts/ts-paths.mjs resolves their `@/` imports.
//
// Safety: a (user, period) claim row is written before sending, so retries
// never double-send; a failed send deletes its claim. A user whose saved
// search cannot be answered (market API down after retries) is skipped whole,
// unclaimed, and picked up by the next run — never a partial digest.
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

register('./ts-paths.mjs', import.meta.url);

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const DRY = flag('dry-run');
const AS_MONDAY = flag('as-monday');
const ONLY = opt('only')?.toLowerCase();
const RENDER = opt('render');
const SEND_TO = opt('send-to');
if (SEND_TO && !ONLY) { console.error('--send-to needs --only=<email>'); process.exit(1); }
const WRITE = !DRY && !SEND_TO;

// ponytail: one fixed gap between sends (~20/min) keeps warm-up traffic steady; at
// 10k+ users switch to spreading the run over a target window instead.
const { APP_BASE_URL = 'https://adlibraryspy.com', ALERTS_SEND_GAP_MS = '3000' } = process.env;
const APP = APP_BASE_URL.replace(/\/$/, '');
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const { query, one, pool } = await import('../lib/db.ts');
const { trackerBoard } = await import('../lib/trackers.ts');
const { loadShops } = await import('../app/(app)/shops/load.ts');
const { queryAds, favoriteIds } = await import('../lib/data.ts');
const { getShops } = await import('../lib/market/shops.ts');
const { marketMovers } = await import('../lib/alerts/market.ts');
const { adFilterFromParams } = await import('../lib/market/ads-params.ts');
const D = await import('../lib/alerts/digest.ts');
const { isoWeekOf } = await import('../lib/weekly/week.ts');
const { unsubscribeUrl } = await import('../lib/weekly/unsubscribe.ts');
const mail = await import('../lib/mail.ts');

const now = new Date();
const DAY = now.toISOString().slice(0, 10);
const WEEK = isoWeekOf(now).key;
const MONDAY = AS_MONDAY || now.getUTCDay() === 1;
const MARKET_DAY = opt('day') || new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
const log = (...a) => console.log('[alerts]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** The market client already rides out restarts (~25s budget); this outlasts a longer outage. */
async function withRetry(label, fn) {
  let last;
  for (const wait of [0, 10_000, 30_000]) {
    if (wait) { log(`${label}: retrying in ${wait / 1000}s (${last?.message})`); await sleep(wait); }
    try { return await fn(); } catch (err) { last = err; }
  }
  throw last;
}

function ctxFor(user, workspaceId) {
  return {
    user: { id: user.id, email: user.email, name: '', emailVerifiedAt: null },
    workspaceId, workspaceName: '', workspaceSlug: '', role: 'member',
  };
}

/** Page 1 of a saved search, through the page's own loader. */
async function runSearch(s, user) {
  const sp = { ...D.queryParams(s.query), page: '1' };
  return withRetry(`search ${s.id}`, async () => {
    if (s.kind === 'shops') {
      const r = await loadShops(ctxFor(user, s.workspace_id), sp);
      return r.rows.map(x => ({
        id: x.id,
        title: x.name || x.domain,
        subtitle: [x.domain, x.monthlyVisits > 0 ? `${compact(x.monthlyVisits)} visits/mo` : '', x.metaAds > 0 ? `${x.metaAds.toLocaleString('en-US')} live ads` : ''].filter(Boolean).join(' · '),
        href: `/shops/${encodeURIComponent(x.id)}`,
      }));
    }
    const r = await queryAds(adFilterFromParams(sp));
    return r.items.map(a => ({
      id: a.id,
      title: a.advertiser || a.domain || 'Ad',
      subtitle: [a.domain, (a.headline || a.adCopy || '').replace(/\s+/g, ' ').trim().slice(0, 110)].filter(Boolean).join(' · '),
      href: `/ads/${encodeURIComponent(a.id)}`,
    }));
  });
}

const MEMBER_JOIN = 'JOIN workspace_members m ON m.workspace_id = s.workspace_id AND m.user_id = s.user_id';

// ---------- 1. seed alerts that have no baseline yet (never mailed) ----------
const unseeded = await query(
  `SELECT s.id, s.kind, s.query, s.workspace_id, u.id AS user_id, u.email
     FROM saved_searches s ${MEMBER_JOIN} JOIN users u ON u.id = s.user_id
    WHERE s.alert AND s.seeded_at IS NULL ${ONLY ? 'AND lower(u.email) = $1' : ''}`,
  ONLY ? [ONLY] : [],
);
let seeded = 0, seedFailed = 0;
for (const s of unseeded) {
  try {
    const items = await runSearch(s, { id: s.user_id, email: s.email });
    if (WRITE) {
      await query('UPDATE saved_searches SET seen_ids=$2, seeded_at=now(), last_run_at=now() WHERE id=$1 AND seeded_at IS NULL',
        [s.id, items.map(i => i.id)]);
    }
    seeded++;
    log(`seed ${s.kind} search ${s.id}: ${items.length} current result(s) are the baseline${WRITE ? '' : ' (not written)'}`);
  } catch (err) {
    seedFailed++;
    console.error(`[alerts] seed ${s.id} failed: ${err.message}`);
  }
}

// ---------- 2. today in the market (once per run) ----------
// If it cannot be computed the run stops: a digest missing a section it would
// have carried is a partial digest. The retry runs pick everyone up.
let movers;
try {
  movers = await withRetry('market movers', () => marketMovers(MARKET_DAY));
} catch (err) {
  console.error(`[alerts] market movers for ${MARKET_DAY} unavailable: ${err.message} — nothing sent, the next run resumes`);
  await pool().end();
  process.exit(1);
}
log(`market ${MARKET_DAY}: ${movers.length} store(s) added ${D.MARKET_MIN_JUMP}+ live Meta ads${movers[0] ? ` (top: ${movers[0].domain} +${movers[0].jump})` : ''}`);

/** The user's niches, from the stores their workspaces track and they saved. */
async function nichesOf(userId) {
  const tracked = await query(
    `SELECT DISTINCT t.shop_id FROM trackers t JOIN workspace_members m ON m.workspace_id = t.workspace_id
      WHERE m.user_id = $1 LIMIT 60`, [userId]);
  const wss = await query('SELECT workspace_id FROM workspace_members WHERE user_id=$1', [userId]);
  const saved = (await Promise.all(wss.map(w => favoriteIds(w.workspace_id, userId, 'shop')))).flat();
  const ids = [...new Set([...tracked.map(r => r.shop_id), ...saved])].slice(0, 100);
  if (!ids.length) return [];
  const shops = await withRetry(`niches ${userId}`, () => getShops(ids));
  return D.topNiches(shops.map(s => s.niches));
}

// ---------- 3. users with a digest due ----------
const users = await query(
  `SELECT u.id, u.email,
          COALESCE(p.frequency, '${D.DEFAULT_FREQUENCY}') AS frequency,
          COALESCE(p.trackers, true) AS trackers,
          COALESCE(p.searches, true) AS searches,
          COALESCE(p.market, true) AS market
     FROM users u LEFT JOIN alert_prefs p ON p.user_id = u.id
    WHERE u.email_verified_at IS NOT NULL
      -- RFC 2606 reserved TLDs (QA accounts such as shots@marketlens.test) can
      -- only bounce, and bounces are what a warming IP cannot afford.
      AND u.email !~* '\\.(test|example|invalid|localhost)$'
      AND COALESCE(p.frequency, '${D.DEFAULT_FREQUENCY}') <> 'off'
      ${ONLY ? 'AND lower(u.email) = $1' : ''}
    ORDER BY u.id`,
  ONLY ? [ONLY] : [],
);
log(`${DAY} (${WEEK}${MONDAY ? ', Monday' : ''}): ${users.length} candidate user(s), ${seeded} search(es) seeded${DRY ? ' — DRY RUN' : SEND_TO ? ` — test send to ${SEND_TO}` : ''}`);

const gapMs = Math.max(200, Number(ALERTS_SEND_GAP_MS) || 3000);
let sent = 0, empty = 0, deferred = 0, failed = 0, skipped = 0, streak = 0, marketStreak = 0;

for (const u of users) {
  const period = D.periodFor(u.frequency, DAY, WEEK, MONDAY);
  if (!period) { skipped++; continue; }
  if (WRITE && await one('SELECT 1 FROM alert_sends WHERE user_id=$1 AND period=$2', [u.id, period])) { skipped++; continue; }

  let brands = [], searches = [], seenUpdates = [], market = null;
  try {
    if (u.trackers) {
      const window = u.frequency === 'daily' ? '1d' : '7d';
      const wss = await query('SELECT workspace_id FROM workspace_members WHERE user_id=$1 ORDER BY joined_at', [u.id]);
      const byShop = new Map();
      for (const { workspace_id } of wss) {
        for (const t of await trackerBoard(workspace_id, window)) {
          const lines = D.trackerLines(t.delta);
          if (lines.length && !byShop.has(t.shopId)) byShop.set(t.shopId, { shopId: t.shopId, name: t.name, domain: t.domain, lines });
        }
      }
      brands = [...byShop.values()];
    }
    if (u.searches) {
      const rows = await query(
        `SELECT s.id, s.kind, s.name, s.query, s.workspace_id, s.seen_ids FROM saved_searches s ${MEMBER_JOIN}
          WHERE s.user_id=$1 AND s.alert AND s.seeded_at IS NOT NULL ORDER BY s.created_at`, [u.id]);
      for (const s of rows) {
        const items = await runSearch(s, u);
        const fresh = new Set(D.newResultIds(items.map(i => i.id), s.seen_ids));
        const news = items.filter(i => fresh.has(i.id));
        if (news.length) {
          searches.push({ id: s.id, name: s.name, kind: s.kind, query: s.query, items: news, total: news.length });
          seenUpdates.push({ id: s.id, seen: D.mergeSeen(s.seen_ids, items.map(i => i.id)) });
        }
      }
    }
    if (u.market && movers.length) market = D.marketPicks(movers, await nichesOf(u.id));
    marketStreak = 0;
  } catch (err) {
    // Never a partial digest: this user waits for the next run, unclaimed.
    deferred++; marketStreak++;
    console.error(`[alerts] ${u.id} deferred: ${err.message}`);
    if (marketStreak >= 3) { console.error('[alerts] 3 users in a row could not be computed — market API down, stopping; the next run resumes'); break; }
    continue;
  }

  const digest = D.buildDigest({ app: APP, frequency: u.frequency, brands, searches, market });
  if (!digest) { empty++; continue; }

  const unsub = unsubscribeUrl(APP, u.id, 'alerts');
  const message = {
    to: SEND_TO || u.email,
    subject: digest.subject,
    heading: digest.heading,
    body: digest.body,
    cta: digest.cta,
    footer: `You get this because alerts are on in AdLibrarySpy. <a href="${APP}/settings/notifications" style="color:#6b7280">Change frequency</a> · <a href="${unsub}" style="color:#6b7280">Unsubscribe</a>.`,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };

  if (DRY) {
    log(`WOULD SEND ${period} to ${u.email}: "${digest.subject}"`);
    for (const b of brands) log(`   brand ${b.domain}: ${b.lines.join(' · ')}`);
    for (const s of searches) log(`   search "${s.name}" (${s.kind}): ${s.total} new — ${s.items.slice(0, 3).map(i => i.title).join(', ')}`);
    if (market) log(`   market${market.niche ? ` [${market.niche}]` : ''}: ${market.items.map(m => `${m.domain} +${m.jump}`).join(', ')}`);
    if (RENDER) {
      fs.mkdirSync(RENDER, { recursive: true });
      const f = path.join(RENDER, `alerts-${u.id}.html`);
      fs.writeFileSync(f, mail.renderMail(message));
      log(`   rendered ${f}`);
    }
    sent++;
    continue;
  }

  if (WRITE) {
    const claim = await one('INSERT INTO alert_sends (user_id, period) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING user_id', [u.id, period]);
    if (!claim) { skipped++; continue; }
  }
  try {
    const { envelope } = await mail.sendMarketingMail(message);
    sent++; streak = 0;
    if (WRITE) {
      for (const x of seenUpdates) await query('UPDATE saved_searches SET seen_ids=$2, last_run_at=now() WHERE id=$1', [x.id, x.seen]);
      await query('UPDATE alert_sends SET summary=$3 WHERE user_id=$1 AND period=$2', [u.id, period,
        JSON.stringify({ brands: brands.length, searches: searches.map(s => ({ id: s.id, new: s.total })), market: market?.items.length ?? 0, niche: market?.niche ?? null, envelope })]);
    }
    log(`sent ${period} to ${message.to} (envelope ${envelope}): "${digest.subject}"`);
  } catch (err) {
    failed++; streak++;
    if (WRITE) await query('DELETE FROM alert_sends WHERE user_id=$1 AND period=$2', [u.id, period]);
    console.error(`[alerts] send to ${u.id} failed: ${err.message}`);
    if (streak >= 5) { console.error('[alerts] 5 consecutive send failures — SMTP down, stopping; the next run resumes'); break; }
  }
  await sleep(gapMs);
}

log(`done: ${sent} ${DRY ? 'would send' : 'sent'}, ${empty} nothing to report, ${skipped} not due/already sent, ${deferred} deferred, ${failed} failed, ${seedFailed} seed failures`);
await pool().end();
process.exit(deferred || failed || seedFailed ? 1 : 0);
