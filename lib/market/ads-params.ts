// The /ads URL query → the index filter. Shared by the /ads page and the
// saved-search alert job (scripts/alerts-digest.mjs), so an alert re-runs
// exactly the search the user saved.
import { cleanLabelValues, type LabelFilter } from './labels';
import { isAdSort } from './ad-options';
import type { AdFilter } from './creatives';

export const ADS_PAGE_SIZE = 25; // 5 columns × 5 rows

const num = (v: string | undefined) => (v && Number.isFinite(+v) ? +v : undefined);

export function adLabelsFromParams(sp: Record<string, string | undefined>): LabelFilter {
  return {
    hook: cleanLabelValues('hook', sp.hook),
    angle: cleanLabelValues('angle', sp.angle),
    funnelStage: cleanLabelValues('funnelStage', sp.funnelStage),
    offer: cleanLabelValues('offer', sp.offer),
    urgency: sp.urgency === '1',
  };
}

export function adFilterFromParams(sp: Record<string, string | undefined>): AdFilter {
  return {
    mode: 'all',
    q: sp.q,
    media: sp.media === 'image' || sp.media === 'video' ? sp.media : undefined,
    format: sp.format,
    placement: sp.placement,
    country: sp.country,
    euUk: sp.euUk === '1',
    from: sp.from,
    to: sp.to,
    category: sp.niche,
    sort: isAdSort(sp.sort) ? sp.sort : undefined,
    storeDomain: sp.store,
    ...adLabelsFromParams(sp),
    page: Math.max(1, num(sp.page) ?? 1),
    limit: ADS_PAGE_SIZE,
  };
}
