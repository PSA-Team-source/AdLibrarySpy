'use client';
// The Shops explorer's rows live in React Query under ['shops', <query>]. A
// change made from a row (star, hide) must reach every cached page, or paging
// back shows the old state until the background refetch lands.
import type { QueryClient } from '@tanstack/react-query';
import type { ShopsPayload } from '@/app/(app)/shops/load';

export const SHOPS_KEY = 'shops';

export function patchCachedShop(qc: QueryClient, id: string, patch: { saved?: boolean }) {
  qc.setQueriesData<ShopsPayload>({ queryKey: [SHOPS_KEY] }, d =>
    d && { ...d, rows: d.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });
}

/** Hiding/unhiding moves a shop between lists and changes every count: refetch. */
export function invalidateShops(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: [SHOPS_KEY] });
}

/**
 * Hide/unhide takes the shop out of the list it was in, at once: every cached
 * page drops the row and the Hidden count moves. The server action and a
 * refetch (invalidateShops) follow; a failed action refetches to restore it.
 */
export function dropCachedShop(qc: QueryClient, id: string, hiddenDelta: 1 | -1) {
  qc.setQueriesData<ShopsPayload>({ queryKey: [SHOPS_KEY] }, d => {
    if (!d || !d.rows.some(r => r.id === id)) return d && { ...d, hiddenCount: Math.max(0, d.hiddenCount + hiddenDelta) };
    return {
      ...d,
      rows: d.rows.filter(r => r.id !== id),
      total: d.total != null ? Math.max(0, d.total - 1) : d.total,
      allPlatformsTotal: d.allPlatformsTotal != null ? Math.max(0, d.allPlatformsTotal - 1) : d.allPlatformsTotal,
      hiddenCount: Math.max(0, d.hiddenCount + hiddenDelta),
    };
  });
}
