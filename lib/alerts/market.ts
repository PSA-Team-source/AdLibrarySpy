// "Today in the market" for the alerts digest: stores whose running Meta ads
// jumped the most from one day to the next.
//
// Source: ClickHouse market_research.market__daily_summary_stores, the crawler's
// daily per-store count of running Meta ads (total_num_ads_running) — the same
// table GET /top-brands/row-signals charts as a store's live-ads history. It is
// the one store metric in the index that moves daily; SimilarWeb traffic is
// monthly and is deliberately not used here. Its num_ads_increase column is 0 on
// every row, so the jump is computed from two days of running counts.
import { chQuery } from '../clickhouse';
import { getShops } from '../market/shops';
import { MARKET_MIN_JUMP, type MarketMover } from './digest';

// Meta reports "50,000+" as 50001: a capped count cannot show a jump.
const META_CAP = 50_000;

const SQL = `
WITH t AS (
  SELECT store_id, toDate(summary_date) AS d, argMax(total_num_ads_running, updated_at) AS r
    FROM market_research.market__daily_summary_stores
   WHERE summary_date >= {d0:Date} AND summary_date < {d1:Date} + 1
     AND deleted_at IS NULL AND _cdc_deleted = 0
   GROUP BY store_id, d)
SELECT store_id, maxIf(r, d = {d0:Date}) AS before, maxIf(r, d = {d1:Date}) AS after, after - before AS jump
  FROM t
 GROUP BY store_id
HAVING countIf(d = {d0:Date}) = 1 AND countIf(d = {d1:Date}) = 1
   AND before > 0 AND after > 0 AND before < {cap:UInt32} AND after < {cap:UInt32}
   AND jump >= {min:UInt32}
 ORDER BY jump DESC
 LIMIT {limit:UInt32}
FORMAT JSONEachRow`;

// A day where more than 99.9% of rows carry a 0 is a day the ad counter did not
// run (2026-09-27..10-01: the v2 crawler inserted 1-3M rows/day with this column
// seeded 0; 0-48 positive rows/day), not a day every store stopped advertising.
// Real counted days run 94-99.5% zeros, so 95% would drop them. Mirrors
// market.UncountedShare in backend-v3-go.
const COVERAGE_SQL = `
SELECT toString(toDate(summary_date)) AS d, toInt64(count()) AS n, toInt64(countIf(total_num_ads_running > 0)) AS p
  FROM market_research.market__daily_summary_stores
 WHERE summary_date >= {d0:Date} AND summary_date < {d1:Date} + 1 AND _cdc_deleted = 0
 GROUP BY d
FORMAT JSONEachRow`;

/** True when the day has enough rows to judge and >99.9% of them are 0. */
export function isUncountedDay(n: number, positive: number): boolean {
  return n >= 1000 && n - positive > 0.999 * n;
}

/** A logo mail clients actually draw (https raster), else '' — then no image at all. */
function emailableLogo(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.(png|jpe?g|gif|webp)$/i.test(u.pathname) ? url : '';
  } catch {
    return '';
  }
}

/**
 * Stores whose running Meta ads rose by at least MARKET_MIN_JUMP from `day - 1`
 * to `day` (UTC dates, YYYY-MM-DD), biggest first, resolved to index stores.
 * A store the index cannot name is dropped, never shown by id. Throws when
 * ClickHouse or the index cannot be asked — the caller must not guess.
 */
export async function marketMovers(day: string, limit = 100): Promise<MarketMover[]> {
  const base = process.env.CLICKHOUSE_URL;
  if (!base) throw new Error('CLICKHOUSE_URL is not set');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`bad day ${day}`);
  const d0 = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  // An uncounted day is missing data: no movers, never "everyone dropped to 0".
  const cov = await chQuery(COVERAGE_SQL, { d0, d1: day });
  const dead = [d0, day].filter(d => {
    const c = cov.find(r => r.d === d);
    return !c || isUncountedDay(Number(c.n), Number(c.p));
  });
  if (dead.length) {
    console.warn(`[market] live-ad counts missing for ${dead.join(', ')} — no movers`);
    return [];
  }
  const rows = (await chQuery(SQL, { d0, d1: day, cap: META_CAP, min: MARKET_MIN_JUMP, limit }))
    .map(r => ({ storeId: String(r.store_id), before: Number(r.before), after: Number(r.after), jump: Number(r.jump) }));
  if (!rows.length) return [];

  const shops = await getShops(rows.map(r => r.storeId));
  const byStore = new Map(shops.map(s => [s.storeId, s]));
  const out: MarketMover[] = [];
  for (const r of rows) {
    const s = byStore.get(r.storeId);
    // Shopify stores only, like the Shops list: the index also carries news
    // sites and marketplaces, which are not "stores scaling" for our readers.
    if (!s || !s.domain || s.platform !== 'shopify') continue;
    out.push({
      shopId: s.id, name: s.name || s.domain, domain: s.domain,
      logo: emailableLogo(s.logo),
      niches: s.niches, before: r.before, after: r.after, jump: r.jump,
    });
  }
  return out;
}
