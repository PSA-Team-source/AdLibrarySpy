// One Landing pages explorer page: shared by the server render of /landing-pages
// and GET /api/landing-pages, so both return the same rows. Mirrors products/load.ts.
import { LANDING_PAGE_TYPES, listLandingPages, type LandingPagesPage } from '@/lib/market/landing-pages';

import { marketPlatformParam } from '@/lib/market-platforms';

export const PAGE_SIZE = 25;

const TRAFFIC_MIN: Record<string, number> = { '10k': 10_000, '100k': 100_000, '1m': 1_000_000, '10m': 10_000_000 };
const LAUNCHED_DAYS = new Set(['7', '30', '90', '180']);

export type LandingPagesPayload = LandingPagesPage;

export async function loadLandingPages(sp: Record<string, string | undefined>, limit = PAGE_SIZE): Promise<LandingPagesPayload> {
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  return listLandingPages({
    q: sp.q?.trim().slice(0, 120) || undefined,
    category: sp.subcategory || sp.category || undefined,
    country: /^[A-Za-z]{2}$/.test(sp.country ?? '') ? sp.country!.toUpperCase() : undefined,
    type: (LANDING_PAGE_TYPES as readonly string[]).includes(sp.type ?? '') ? sp.type : undefined,
    trafficMin: sp.traffic && TRAFFIC_MIN[sp.traffic] ? String(TRAFFIC_MIN[sp.traffic]) : undefined,
    launched: sp.launched && LAUNCHED_DAYS.has(sp.launched) ? sp.launched : undefined,
    store: sp.store || undefined,
    platform: marketPlatformParam(sp.platform),
    sort: sp.sort || undefined,
    dir: sp.dir === 'asc' ? 'asc' : undefined,
    page,
    limit,
  });
}
