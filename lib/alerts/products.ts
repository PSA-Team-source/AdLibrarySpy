// "Winning products today" for the alerts digest: the storefront products that
// the most NEW Meta ads started pointing at over the last two days.
//
// Source: ClickHouse market_research.market__creatives (the ad library the /ads
// page and the Products explorer read): creatives whose landing URL is a
// storefront product page (/products/<handle>) grouped by landing host + handle
// exactly like the Go winning-products catalogue (AdLinkedProducts, wpKey =
// host/handle), counting distinct creatives whose start_at falls in the window.
// The product's title, image and store come from that catalogue
// (lib/market/products.ts listWinningProducts), i.e. from the storefront itself;
// a product the catalogue cannot describe, or whose store is not a Shopify store
// in the Shops index, is dropped — never shown by handle.
import { listWinningProducts } from '../market/products';
import { getShops } from '../market/shops';
import { PRODUCTS_MIN_NEW_ADS, PRODUCTS_ROWS, type WinningToday } from './digest';

const SQL = `
SELECT host, handle, uniqExact(id) AS n
  FROM (
    SELECT lower(replaceRegexpOne(domain(link_url), '^www\\\\.', '')) AS host,
           lower(extract(link_url, '/products/([^/?#&]+)')) AS handle, id
      FROM market_research.market__creatives
     WHERE _cdc_deleted = 0 AND deleted_at IS NULL AND link_url LIKE '%/products/%'
       AND start_at >= {from:Int64} AND start_at < {to:Int64})
 WHERE host != '' AND handle != ''
 GROUP BY host, handle
HAVING n >= {min:UInt32}
 ORDER BY n DESC
 LIMIT {limit:UInt32}
FORMAT JSONEachRow`;

/** An https raster image mail clients draw, else '' (then no image cell at all). */
export function emailableImage(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.(png|jpe?g|gif|webp)$/i.test(u.pathname) ? url : '';
  } catch {
    return '';
  }
}

/**
 * Products with the most new Meta ads started on `day - 1` and `day` (UTC dates,
 * YYYY-MM-DD; a 48h window), biggest first. Throws when ClickHouse cannot be
 * asked; a product the catalogue cannot resolve is skipped.
 */
export async function winningProductsToday(day: string, rows = PRODUCTS_ROWS): Promise<WinningToday[]> {
  const base = process.env.CLICKHOUSE_URL;
  if (!base) throw new Error('CLICKHOUSE_URL is not set');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`bad day ${day}`);
  const end = Date.parse(`${day}T00:00:00Z`) + 86_400_000;
  const start = end - 2 * 86_400_000;
  const url = new URL(base);
  for (const [k, v] of Object.entries({ from: start / 1000, to: end / 1000, min: PRODUCTS_MIN_NEW_ADS, limit: Math.max(40, rows * 3) })) {
    url.searchParams.set(`param_${k}`, String(v));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'default',
      'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
    },
    body: SQL,
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`clickhouse ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const top = (await res.text()).split('\n').filter(Boolean).map(l => JSON.parse(l) as { host: string; handle: string; n: number | string });
  const from = new Date(start).toISOString().slice(0, 10);

  const out: WinningToday[] = [];
  const seenStores = new Set<string>();
  for (const t of top) {
    if (out.length >= rows) break;
    if (seenStores.has(t.host)) continue;           // one product per store keeps the list varied
    // ponytail: one catalogue call per candidate (≤40, once per run, shared by
    // every user). A batch-by-keys endpoint is the upgrade if the list grows.
    const page = await listWinningProducts({ store: t.host, sort: 'new_ads', limit: 100 }).catch(() => null);
    const p = page?.items.find(i => i.key === `${t.host}/${t.handle}`);
    if (!p?.title || !p.store.id) continue;
    const [shop] = await getShops([p.store.id]).catch(() => []);
    if (!shop || shop.platform !== 'shopify' || !shop.domain) continue;
    seenStores.add(t.host);
    out.push({
      title: p.title, image: emailableImage(p.image),
      shopId: shop.id, storeName: shop.name || shop.domain, domain: shop.domain,
      newAds: Number(t.n), from, to: day, niches: shop.niches ?? [],
    });
  }
  return out;
}
