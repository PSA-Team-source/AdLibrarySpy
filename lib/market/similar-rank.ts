import type { Shop } from '@/lib/types';

type Rankable = Pick<Shop, 'id' | 'domain' | 'country' | 'monthlyVisits' | 'trafficSource' | 'niches'> & { visitorCountries?: { code: string }[] };

/** A visit figure the shop itself was measured at (never the index's estimate). */
export const measured = (s: Rankable) => s.monthlyVisits > 0 && !!s.trafficSource && s.trafficSource !== 'index';

/**
 * Similar shops for `shop`: same category first, then same origin country (or
 * the shop's main visitor country), then the closest traffic band by log
 * distance. Drops the shop itself and anything without its own measured visits,
 * so every figure a card prints is that card's own measurement.
 */
export function rankSimilar<T extends Rankable>(shop: Rankable, pool: T[], limit: number): T[] {
  const cat = shop.niches[0];
  const home = new Set([shop.country, shop.visitorCountries?.[0]?.code].filter(Boolean));
  const own = measured(shop) ? Math.log10(shop.monthlyVisits) : null;
  const seen = new Set<string>();
  const key = (s: T) => [
    cat && s.niches.includes(cat) ? 0 : 1,
    s.country && home.has(s.country) ? 0 : 1,
    own == null ? -Math.log10(s.monthlyVisits) : Math.abs(Math.log10(s.monthlyVisits) - own),
  ];
  return pool
    .filter(s => s.id !== shop.id && s.domain !== shop.domain && measured(s) && !seen.has(s.domain) && seen.add(s.domain))
    .map(s => ({ s, k: key(s) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2])
    .slice(0, limit)
    .map(x => x.s);
}
