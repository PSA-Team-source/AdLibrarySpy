// Per-row signals for the Shops explorer (GET /top-brands/row-signals).
//
// One batch call per page returns what a row draws beyond the brand document:
// the storefront screenshot, SimilarWeb's monthly history and top visitor
// countries for the exact host, the daily running-ads series and the country
// split of the store's active creatives. Every part is optional — a store the
// crawl has not reached simply has no key, and the row omits that element.
import { marketGet } from './client';
import { parseRowSignals, type RowSignals } from './row-signals';

export { applyRowSignals, type RowSignals } from './row-signals';

/**
 * Signals for a page of shops, keyed by store_id. An unreachable or older API
 * (the endpoint ships with the Go backend) yields an empty map: rows then show
 * only what the brand document itself carries.
 */
export async function shopRowSignals(storeIds: string[]): Promise<Map<string, RowSignals>> {
  const ids = [...new Set(storeIds.filter(Boolean))].slice(0, 100);
  const out = new Map<string, RowSignals>();
  if (!ids.length) return out;
  try {
    const payload = await marketGet(`/top-brands/row-signals?ids=${encodeURIComponent(ids.join(','))}`, {
      auth: true, revalidate: 300, retries: 1,
    });
    const data = ((payload as { data?: unknown })?.data ?? {}) as Record<string, unknown>;
    for (const id of ids) {
      const raw = data[id];
      if (raw && typeof raw === 'object') out.set(id, parseRowSignals(raw as Record<string, unknown>));
    }
  } catch {
    // Optional enrichment — the table still renders from the brand documents.
  }
  return out;
}
