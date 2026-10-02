'use server';
// "Start here" data: live stores adding the most Meta ads, optionally in one
// category, minus what the workspace hid. Shared by the server render and the
// category chips (a server action, so no new route).
import { requireCtx } from '@/lib/auth/guard';
import { categoryTree, getShops, listShops } from '@/lib/market/shops';
import { favouriteNiche, pickStarters, type StarterShop } from '@/lib/start-here';
import { hiddenShopIds, viewedShopIds } from './data';

/** Up to 12 stores: 3 on screen, the rest slide in as the user dismisses. */
export async function starterShops(categoryId: string | null): Promise<StarterShop[]> {
  const ctx = await requireCtx();
  if (categoryId != null && !/^\d{1,9}$/.test(categoryId)) return [];
  const [page, hidden, viewed] = await Promise.all([
    listShops(
      { sortBy: 'num_ads_increase', sortOrder: 'desc', trafficMin: 20_000, limit: 40, ...(categoryId ? { category: categoryId } : {}) },
      { crux: false },
    ).catch(e => { console.error('[start-here] listShops', categoryId, e?.message ?? e); return null; }),
    hiddenShopIds(ctx.workspaceId).catch(() => [] as string[]),
    viewedShopIds(ctx.workspaceId, ctx.user.id).catch(() => [] as string[]),
  ]);
  // Already opened or hidden = not a discovery any more.
  const skip = new Set([...hidden, ...viewed]);
  return pickStarters((page?.items ?? []).filter(s => !skip.has(s.id)), 12)
    .map(({ id, name, domain, logo, metaAds, monthlyVisits, trafficSource }) => ({ id, name, domain, logo, metaAds, monthlyVisits, trafficSource }));
}

/** The chips: the user's own favourite category (from stores they opened) first, then the biggest ones. */
export async function starterNiches(): Promise<{ favourite: { id: string; name: string } | null; niches: { id: string; name: string }[] }> {
  const ctx = await requireCtx();
  const [tree, viewedIds] = await Promise.all([
    categoryTree(),
    viewedShopIds(ctx.workspaceId, ctx.user.id).catch(() => [] as string[]),
  ]);
  const viewed = viewedIds.length ? await getShops(viewedIds.slice(0, 20)).catch(() => []) : [];
  const favName = favouriteNiche(viewed);
  const fav = favName ? tree.find(t => t.name === favName) : undefined;
  const niches = tree.filter(t => t.id !== fav?.id).slice(0, 7).map(t => ({ id: t.id, name: t.name }));
  return { favourite: fav ? { id: fav.id, name: fav.name } : null, niches };
}
