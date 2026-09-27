// One Products explorer page: shared by the server render of /products (first
// paint) and GET /api/products (every filter, sort and page change after it),
// so both always return the same rows. Mirrors app/(app)/shops/load.ts.
import { listWinningProducts, type WinningProductsPage } from '@/lib/market/products';

export const PAGE_SIZE = 25;

/** Traffic chip value → minimum monthly store visits. */
const TRAFFIC_MIN: Record<string, number> = { '10k': 10_000, '100k': 100_000, '1m': 1_000_000, '10m': 10_000_000 };
/** First-ad window chip value → days. */
const LAUNCHED_DAYS = new Set(['7', '30', '90', '180']);

export type ProductsPayload = WinningProductsPage;

export async function loadProducts(sp: Record<string, string | undefined>, limit = PAGE_SIZE): Promise<ProductsPayload> {
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const price = (v: string | undefined) => (v && Number.isFinite(+v) && +v > 0 ? String(+v) : undefined);
  return listWinningProducts({
    q: sp.q?.trim().slice(0, 120) || undefined,
    category: sp.subcategory || sp.category || undefined,
    country: /^[A-Za-z]{2}$/.test(sp.country ?? '') ? sp.country!.toUpperCase() : undefined,
    currency: /^[A-Za-z]{3}$/.test(sp.currency ?? '') ? sp.currency!.toUpperCase() : undefined,
    priceMin: price(sp.priceMin),
    priceMax: price(sp.priceMax),
    trafficMin: sp.traffic && TRAFFIC_MIN[sp.traffic] ? String(TRAFFIC_MIN[sp.traffic]) : undefined,
    launched: sp.launched && LAUNCHED_DAYS.has(sp.launched) ? sp.launched : undefined,
    store: sp.store || undefined,
    sort: sp.sort || undefined,
    dir: sp.dir === 'asc' ? 'asc' : undefined,
    page,
    limit,
  });
}
