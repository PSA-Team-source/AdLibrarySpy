// AI creative labels (hook / angle / funnel stage / offer / urgency / video style).
//
// Produced by a text classifier run over each creative's ad text and served
// by the Go creatives endpoints as `ai_labels`. These are MODEL JUDGMENTS with a
// confidence, not measurements. The API omits a key when the model was not
// confident enough, so an absent label means "no confident judgment" -- never
// "this ad has no hook". Nothing here fills a gap.
//
// Pure module (no imports that need the bundler) so tests/unit.test.mjs can
// import it directly.
import type { AdLabel, AdLabels } from '../types';

/**
 * Taxonomy values the API accepts as filter params. These are the only strings
 * hardcoded here: display labels and descriptions always come from the API.
 */
export const LABEL_TAXONOMY = {
  hook: ['pain_point', 'benefit', 'offer', 'social_proof', 'curiosity', 'story', 'product_intro'],
  angle: ['problem_solution', 'quality', 'value_price', 'health_wellness', 'convenience', 'identity_style', 'gifting', 'sustainability', 'novelty'],
  funnelStage: ['awareness', 'consideration', 'conversion', 'retention'],
  offer: ['percent_off', 'amount_off', 'bundle', 'free_shipping', 'free_gift', 'sale_event', 'none'],
  // Video ads only, judged from frames by a vision model (Go domain/creative_style.go).
  style: ['cartoon', 'vsl', 'ugc', 'talking_head', 'podcast', 'street_interview', 'skit', 'demo', 'before_after', 'screen_recording', 'slideshow', 'lifestyle'],
} as const;

export type LabelField = keyof typeof LABEL_TAXONOMY;
export const LABEL_FIELDS = Object.keys(LABEL_TAXONOMY) as LabelField[];

/** API field name (snake_case) for each categorical label. */
const API_KEY: Record<LabelField, string> = {
  hook: 'hook', angle: 'angle', funnelStage: 'funnel_stage', offer: 'offer', style: 'style',
};

/** Server-side label filters. Values within a field are OR'd, fields AND'd. */
export interface LabelFilter {
  hook?: string[];
  angle?: string[];
  funnelStage?: string[];
  offer?: string[];
  style?: string[];
  urgency?: boolean;
}

/**
 * Keep only taxonomy values, so a crafted `?hook=` never reaches the index as
 * free text. Accepts a comma-separated string or an array.
 */
export function cleanLabelValues(field: LabelField, raw: unknown): string[] | undefined {
  const parts = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(',') : [];
  const allowed = LABEL_TAXONOMY[field] as readonly string[];
  const out = [...new Set(parts.map(s => s.trim()).filter(s => allowed.includes(s)))];
  return out.length ? out : undefined;
}

/** Write the label filters onto an API query string (the Go param names). */
export function setLabelParams(p: URLSearchParams, f: LabelFilter): void {
  for (const field of LABEL_FIELDS) {
    const vals = cleanLabelValues(field, f[field]);
    if (vals) p.set(field, vals.join(','));
  }
  if (f.urgency) p.set('urgency', 'true');
}

export function hasLabelFilter(f: LabelFilter): boolean {
  return !!f.urgency || LABEL_FIELDS.some(k => !!cleanLabelValues(k, f[k]));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const prob = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;

function mapLabel(raw: unknown): AdLabel | undefined {
  if (!isObj(raw)) return undefined;
  const value = typeof raw.value === 'string' ? raw.value : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const confidence = prob(raw.confidence);
  // A label is shown with its confidence; without all three it is not shown.
  if (!value || !label || confidence === null) return undefined;
  return { value, label, confidence };
}

/**
 * Map the API's `ai_labels` object. Returns null when it is null, malformed, or
 * carries no confident label -- the caller then renders nothing at all.
 */
export function mapAiLabels(raw: unknown): AdLabels | null {
  if (!isObj(raw)) return null;
  const out: AdLabels = {
    model: typeof raw.model === 'string' ? raw.model : '',
    labeledAt: typeof raw.labeled_at === 'string' ? raw.labeled_at : '',
  };
  let any = false;
  for (const field of LABEL_FIELDS) {
    const l = mapLabel(raw[API_KEY[field]]);
    if (l) { out[field] = l; any = true; }
  }
  if (isObj(raw.urgency) && raw.urgency.value === true) {
    const p = prob(raw.urgency.probability);
    if (p !== null) { out.urgency = { probability: p }; any = true; }
  }
  return any ? out : null;
}

export interface FacetEntry { value: string; label: string; description: string; count: number }
export interface LabelFacets {
  /** Creatives matching the filter. */
  total: number;
  /** How many of `total` carry at least one confident label. */
  labeled: number;
  facets: Record<LabelField, FacetEntry[]> & { urgency: FacetEntry[] };
}

function mapFacetList(raw: unknown): FacetEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObj)
    .map(e => ({
      value: typeof e.value === 'string' ? e.value : e.value === true ? 'true' : '',
      label: typeof e.label === 'string' ? e.label.trim() : '',
      description: typeof e.description === 'string' ? e.description.trim() : '',
      count: typeof e.count === 'number' && Number.isFinite(e.count) ? e.count : 0,
    }))
    .filter(e => e.value && e.label && e.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Map the label-facets payload. null when it does not carry real counts. */
export function mapLabelFacets(payload: unknown): LabelFacets | null {
  const d = isObj(payload) && isObj(payload.data) ? payload.data : payload;
  if (!isObj(d)) return null;
  const total = d.total, labeled = d.labeled;
  if (typeof total !== 'number' || !Number.isFinite(total)) return null;
  if (typeof labeled !== 'number' || !Number.isFinite(labeled)) return null;
  const f = isObj(d.facets) ? d.facets : {};
  return {
    total,
    labeled,
    facets: {
      hook: mapFacetList(f.hook),
      angle: mapFacetList(f.angle),
      funnelStage: mapFacetList(f.funnel_stage),
      offer: mapFacetList(f.offer),
      style: mapFacetList(f.style),
      urgency: mapFacetList(f.urgency),
    },
  };
}

/** Share of a brand's labeled creatives, whole percent. 0 when nothing is labeled. */
export function shareOf(count: number, labeled: number): number {
  return labeled > 0 ? Math.round((count * 100) / labeled) : 0;
}
