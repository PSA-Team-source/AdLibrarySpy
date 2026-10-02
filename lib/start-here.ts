// "Start here" on Home and Shops: three live stores for a user who has not opened
// anything yet. Pure, shared with tests/start-here.test.mjs.

/** Shown until the user has opened 3 things or tracks a store. */
export function needsStartHere(viewed: { shop: number; ad: number; advertiser: number }, trackers: number): boolean {
  return trackers === 0 && viewed.shop + viewed.ad + viewed.advertiser < 3;
}

export interface StarterShop { id: string; name: string; domain: string; logo: string; metaAds: number; monthlyVisits: number; trafficSource: string | null }

/**
 * The first `n` usable stores, in the order given (the index's "most ads added"
 * order). A store without an id, a name or running ads is skipped, never padded.
 */
export function pickStarters<T extends StarterShop>(shops: T[], n = 3): T[] {
  return shops.filter(s => s.id && s.domain && s.metaAds > 0).slice(0, n);
}

/**
 * What the user likes: the category name that shows up most often across the
 * stores they opened (each store's broadest category, recent first breaks ties).
 * null = they have not opened a categorised store yet.
 */
export function favouriteNiche(viewed: { niches: string[] }[]): string | null {
  const score = new Map<string, number>();
  viewed.forEach((s, i) => {
    const n = s.niches[0];
    if (n) score.set(n, (score.get(n) ?? 0) + 1 + (viewed.length - i) / (viewed.length * 10));
  });
  let best: string | null = null;
  for (const [n, v] of score) if (best == null || v > score.get(best)!) best = n;
  return best;
}
