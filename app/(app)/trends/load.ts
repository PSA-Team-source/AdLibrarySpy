// Cached loaders for /trends. Every section reads the market index through the
// app's own list/count calls (lib/data queryShops, lib/market/shops), and each
// result is cached server-side, so a page view costs no index fan-out: the
// numbers move once a month (SimilarWeb) and the cache refreshes in the
// background (stale-while-revalidate).
//
// An empty result is thrown, never cached — unstable_cache then keeps serving the
// last good copy, and a section with nothing to show on a cold failure simply
// does not render.
import { unstable_cache } from 'next/cache';
import type { Shop } from '@/lib/types';
import { queryShops } from '@/lib/data';
import { categoryTree, countShops, listShops } from '@/lib/market/shops';
import { mapLimit } from '@/lib/seo/directory';
import {
  RISER_BANDS, MAX_GROWTH_PCT, NICHE_MIN_BRANDS, NICHE_MIN_GROWTH, NICHE_MIN_VISITS,
  isBreakout, rankNiches, type NicheCount, type RankedNiche, type RiserBand,
} from '@/lib/trends';

export interface TrendShop {
  id: string;
  name: string;
  domain: string;
  logo: string;
  country: string;
  niches: string[];
  visits: number;
  prevVisits: number;
  growthPct: number;
  /** SimilarWeb month the visits measure, "2026-08". */
  period: string;
  products: { title: string; image: string }[];
}

function toTrendShop(s: Shop): TrendShop {
  const sw = s.similarweb!;
  return {
    id: s.id, name: s.name, domain: s.domain, logo: s.logo, country: s.country, niches: s.niches,
    visits: sw.visits, prevVisits: sw.prevVisits, growthPct: sw.growthPct ?? 0, period: sw.period,
    products: s.bestSellers
      .filter((p, i, all) => p.image && p.title.trim() && !NOT_A_PRODUCT.test(p.title)
        && all.findIndex(q => q.title.trim() === p.title.trim()) === i)
      .slice(0, 3)
      .map(p => ({ title: p.title.trim(), image: p.image! })),
  };
}

/** Checkout add-ons stores list as products ("Expedited Shipping", "Package Protection"). */
const NOT_A_PRODUCT = /\b(shipping|package protection|shipping protection|insurance|gift ?card|e-?gift|donation)\b/i;

const HOUR = 3600;

/** Fastest-growing Shopify stores at a visit floor, credible breakouts only (lib/trends isBreakout). */
export const loadRisers = unstable_cache(async (band: RiserBand): Promise<TrendShop[]> => {
  const min = RISER_BANDS[band].min;
  const { items } = await queryShops({
    view: 'fastest-growing', trafficMin: min, growthMax: MAX_GROWTH_PCT, limit: 100,
  });
  const out = items.filter(s => isBreakout(s.similarweb, min)).slice(0, 25).map(toTrendShop);
  if (!out.length) throw new Error(`trends risers ${band}: no rows`);
  return out;
}, ['trends:risers:v1'], { revalidate: HOUR });

export interface NicheLeader { id: string; name: string; domain: string; logo: string; growthPct: number }
export interface TrendNiche extends RankedNiche { leaders: NicheLeader[] }
export interface NicheTrends { period: string; niches: TrendNiche[] }

/**
 * Subcategories ranked by the share of their measured stores (10K+ visits) that
 * grew 50%+ month over month — two list totals per subcategory, the whole index,
 * not a sample — each with its three fastest credible risers.
 */
export const loadNicheTrends = unstable_cache(async (): Promise<NicheTrends> => {
  const tree = await categoryTree();
  const subs = tree.flatMap(t => t.children
    .filter(c => c.brandCount >= NICHE_MIN_BRANDS)
    .map(c => ({ id: c.id, name: c.name, parentId: t.id, parentName: t.name })));

  const counts = await mapLimit(subs, 6, async (n): Promise<NicheCount | null> => {
    try {
      const [measured, breakout] = await Promise.all([
        countShops({ category: n.id, trafficMin: NICHE_MIN_VISITS }),
        countShops({ category: n.id, trafficMin: NICHE_MIN_VISITS, growthMin: NICHE_MIN_GROWTH }),
      ]);
      return measured == null || breakout == null ? null : { ...n, measured, breakout };
    } catch {
      return null;
    }
  });
  const ranked = rankNiches(counts.filter((c): c is NicheCount => !!c));
  if (!ranked.length) throw new Error('trends niches: no counts returned');

  // Each niche's fastest credible risers. A store filed under two niches (Dogs
  // and Pet Food) leads only the higher-ranked one, so no two cards repeat.
  const leaderFloor = 50_000;
  const candidates = await mapLimit(ranked, 4, n => listShops({
    category: n.id, trafficMin: leaderFloor, growthMax: MAX_GROWTH_PCT,
    sortBy: 'sw_growth_pct', sortOrder: 'desc', limit: 20,
  }).then(r => r.items.filter(s => isBreakout(s.similarweb, leaderFloor))).catch(() => [] as Shop[]));
  const used = new Set<string>();
  const niches = ranked.map((n, i): TrendNiche => {
    const picked = candidates[i].filter(s => !used.has(s.id)).slice(0, 3);
    picked.forEach(s => used.add(s.id));
    return {
      ...n,
      leaders: picked.map(s => ({
        id: s.id, name: s.name, domain: s.domain, logo: s.logo, growthPct: s.similarweb?.growthPct ?? 0,
      })),
    };
  });
  const period = candidates.flat().find(s => s.similarweb?.period)?.similarweb?.period ?? '';
  return { period, niches };
}, ['trends:niches:v1'], { revalidate: 6 * HOUR });
