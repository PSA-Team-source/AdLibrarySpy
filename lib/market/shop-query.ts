// /shops URL ⇄ index filter. Pure (no imports), so the page loader, the
// toolbar and tests/shop-query.test.mjs all read the same rules.
//
// URL names (TrendTrack parity) and the older names they replace, which stay
// readable because saved searches and digest emails carry them:
//   minTraffic/maxTraffic          (traffic=10k|100k|1m|10m)
//   growth=1m:gt:20,and:6m:lt:-10  (growth=declining|positive|10|25|50)
//   minProducts/maxProducts        (productsMin/productsMax)
//   minPrice/maxPrice in dollars   (avgPriceMin/avgPriceMax)
//   creationCountry, excludeCreationCountry: comma lists (country=US)
//   visitorCountry: comma list
//   minDate/maxDate YYYY-MM-DD     (created=30d|90d|1y|2y, still offered as presets)
//   niche, nicheSub, language, currency, theme, social, app, excludeApp,
//   pixel, excludePixel, tech: '|' lists (names can hold commas)
//   plan=plus|non-plus, minRating/maxRating, minReviews/maxReviews, minAds/maxAds

export type GrowthPeriod = '1m' | '3m' | '6m';
export interface GrowthRule {
  period: GrowthPeriod;
  direction: 'greater' | 'lower';
  /** Percent, the unit similarwebGrowth already uses (10 = 10%). */
  value: number;
  /** How this rule joins the ones before it (the first rule's is 'AND'). */
  operator: 'AND' | 'OR';
}

const PERIODS: GrowthPeriod[] = ['1m', '3m', '6m'];

/** `1m:gt:20,and:6m:lt:-10` → rules; anything malformed is dropped, never guessed. */
export function parseGrowthRules(s: string | undefined): GrowthRule[] {
  if (!s || !s.includes(':')) return [];
  const out: GrowthRule[] = [];
  for (const part of s.split(',')) {
    const bits = part.trim().toLowerCase().split(':');
    let operator: 'AND' | 'OR' = 'AND';
    if (bits[0] === 'and' || bits[0] === 'or') operator = bits.shift() === 'or' ? 'OR' : 'AND';
    const [period, dir, raw] = bits;
    const value = Number(raw);
    if (!PERIODS.includes(period as GrowthPeriod) || (dir !== 'gt' && dir !== 'lt') || raw === '' || !Number.isFinite(value)) continue;
    out.push({ period: period as GrowthPeriod, direction: dir === 'gt' ? 'greater' : 'lower', value, operator: out.length ? operator : 'AND' });
  }
  return out;
}

export function formatGrowthRules(rules: GrowthRule[]): string {
  return rules
    .filter(r => Number.isFinite(r.value))
    .map((r, i) => `${i ? `${r.operator.toLowerCase()}:` : ''}${r.period}:${r.direction === 'greater' ? 'gt' : 'lt'}:${r.value}`)
    .join(',');
}

/** "1 month > 20% and 6 months < -10%" */
export function describeGrowthRules(rules: GrowthRule[]): string {
  return rules.map((r, i) => `${i ? `${r.operator.toLowerCase()} ` : ''}${r.period.replace('m', r.period === '1m' ? ' month' : ' months')} ${r.direction === 'greater' ? '>' : '<'} ${r.value}%`).join(' ');
}

type SP = Record<string, string | undefined>;

const num = (v: string | undefined): number | undefined => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const codes = (v: string | undefined): string[] =>
  [...new Set((v ?? '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)))];
export const names = (v: string | undefined): string[] =>
  [...new Set((v ?? '').split('|').map(x => x.trim()).filter(Boolean))];
const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

const TRAFFIC_PRESET: Record<string, number> = { '10k': 10_000, '100k': 100_000, '1m': 1_000_000, '10m': 10_000_000 };
const CREATED_PRESET: Record<string, number> = { '30d': 30, '90d': 90, '1y': 365, '2y': 730 };

/** The filter fields a /shops URL asks for (lists, sort and paging are the loader's). */
export interface ShopQueryFilter {
  country?: string; creationCountries?: string[]; excludeCreationCountries?: string[];
  visitorCountry?: string; visitorCountries?: string[];
  trafficMin?: number; trafficMax?: number;
  growthMin?: number; growthMax?: number; growthRules?: GrowthRule[];
  productsMin?: number; productsMax?: number; avgPriceMin?: number; avgPriceMax?: number;
  adsMin?: number; adsMax?: number;
  createdAfter?: string; createdBefore?: string;
  niches?: string[]; nicheSubs?: string[];
  pixels?: string[]; excludePixels?: string[]; tech?: string[];
  profile: Partial<Record<'language' | 'currency' | 'theme' | 'social' | 'app', string[]>>;
  excludeApps?: string[];
  shopifyPlus?: 'plus' | 'non-plus';
  trustpilotScoreMin?: number; trustpilotScoreMax?: number;
  trustpilotReviewsMin?: number; trustpilotReviewsMax?: number;
}

const nonEmpty = <T>(a: T[]) => (a.length ? a : undefined);

export function parseShopQuery(sp: SP, now = Date.now()): ShopQueryFilter {
  const f: ShopQueryFilter = { profile: {} };

  f.trafficMin = num(sp.minTraffic) ?? (sp.traffic ? TRAFFIC_PRESET[sp.traffic] : undefined);
  f.trafficMax = num(sp.maxTraffic);

  const rules = parseGrowthRules(sp.growth);
  if (rules.length) f.growthRules = rules;
  else if (sp.growth === 'declining') f.growthMax = -0.01;
  else if (sp.growth === 'positive') f.growthMin = 0;
  else if (sp.growth && ['10', '25', '50'].includes(sp.growth)) f.growthMin = Number(sp.growth);

  f.productsMin = num(sp.minProducts) ?? num(sp.productsMin);
  f.productsMax = num(sp.maxProducts) ?? num(sp.productsMax);
  f.avgPriceMin = num(sp.minPrice) ?? num(sp.avgPriceMin);
  f.avgPriceMax = num(sp.maxPrice) ?? num(sp.avgPriceMax);
  f.adsMin = num(sp.minAds);
  f.adsMax = num(sp.maxAds);

  // One included origin and no exclusions is the plain list's own filter
  // (selectedCountry), so the simple case never needs the POST endpoint.
  const include = codes([sp.creationCountry, sp.country].filter(Boolean).join(','));
  const exclude = codes(sp.excludeCreationCountry).filter(c => !include.includes(c));
  if (include.length === 1 && !exclude.length) f.country = include[0];
  else { f.creationCountries = nonEmpty(include); f.excludeCreationCountries = nonEmpty(exclude); }

  const visitors = codes(sp.visitorCountry);
  if (visitors.length === 1) f.visitorCountry = visitors[0];
  else f.visitorCountries = nonEmpty(visitors);

  const from = day(sp.minDate), to = day(sp.maxDate);
  if (from) f.createdAfter = `${from}T00:00:00Z`;
  else if (sp.created && CREATED_PRESET[sp.created]) f.createdAfter = new Date(now - CREATED_PRESET[sp.created] * 86_400_000).toISOString();
  if (to) f.createdBefore = `${to}T23:59:59Z`;

  f.niches = nonEmpty(names(sp.niche));
  f.nicheSubs = nonEmpty(names(sp.nicheSub));
  f.pixels = nonEmpty(names(sp.pixel));
  f.excludePixels = nonEmpty(names(sp.excludePixel));
  f.tech = nonEmpty(names(sp.tech));
  for (const k of ['language', 'currency', 'theme', 'social', 'app'] as const) {
    const v = names(sp[k]);
    if (v.length) f.profile[k] = v;
  }
  f.excludeApps = nonEmpty(names(sp.excludeApp));
  if (sp.plan === 'plus' || sp.plan === 'non-plus') f.shopifyPlus = sp.plan;
  f.trustpilotScoreMin = num(sp.minRating);
  f.trustpilotScoreMax = num(sp.maxRating);
  f.trustpilotReviewsMin = num(sp.minReviews);
  f.trustpilotReviewsMax = num(sp.maxReviews);

  for (const k of Object.keys(f) as (keyof ShopQueryFilter)[]) if (f[k] === undefined) delete f[k];
  return f;
}

/** `{min,max}` with only the ends that are set; undefined when neither is. `scale` 100 = dollars → cents. */
export function range(min: number | undefined, max: number | undefined, scale = 1) {
  if (min == null && max == null) return undefined;
  const v = (n: number) => (scale === 1 ? n : Math.round(n * scale));
  return { ...(min != null ? { min: v(min) } : {}), ...(max != null ? { max: v(max) } : {}) };
}
