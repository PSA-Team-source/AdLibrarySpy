// SimilarWeb, measured for the EXACT store host.
//
// The market index's own `monthly_traffic` is the PARENT domain's figure —
// store.nytimes.com was filed with nytimes.com's 178M visits — and roughly half
// the real number even where the host is right (ea.com 40.2M against
// SimilarWeb's 77.1M). Its `similar_web` rank is a ~12.1M sentinel for every
// subdomain storefront. The platform now crawls SimilarWeb's site overview per
// host and carries the result on the brand row as `sw_*`, with the full dossier
// under `similarweb_detail` on /top-brands/{id}.
//
// HARD RULE, same as lib/traffic/provider.ts: nothing here invents a number. A
// store the crawl has not reached carries no sw_* fields at all, `mapFacts`
// returns null, and the UI falls back to the index figure LABELLED as the
// index's estimate. An absent field inside a measured store is null/'' — never
// a zero that would read as a measurement.
import type {
  CountryShare, Point, ShareRow, SimilarWebDetail, SimilarWebFacts, SimilarWebKeyword,
} from '@/lib/types';

/** A finite positive number, or null. Zero is not a measurement here. */
function pos(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A finite number of any sign (growth can be negative), or null. */
function finite(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const text = (v: unknown): string => (v == null ? '' : String(v).trim());

/** "2026-08-01T00:00:00Z" and "2026-08-01" both read as the date. */
const isoDate = (v: unknown): string => text(v).slice(0, 10);

/** "202608" and "2026-08" both read as the month. */
function month(v: unknown): string {
  const s = text(v);
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : '';
}

/**
 * The sw_* block of a brand row. null = the crawl has not reached this store.
 *
 * Keyed off `sw_visits`: that is the measurement everything else describes, so
 * a row with ranks but no visits is not a traffic measurement and is treated as
 * uncrawled rather than rendered as a store with no visitors.
 */
export function mapFacts(b: Record<string, unknown>): SimilarWebFacts | null {
  const visits = pos(b.sw_visits);
  if (visits == null) return null;
  return {
    period: month(b.sw_period),
    visits,
    prevVisits: pos(b.sw_prev_visits) ?? 0,
    growthPct: finite(b.sw_growth_pct),
    globalRank: pos(b.sw_global_rank),
    countryCode: text(b.sw_country_code).toUpperCase().slice(0, 2),
    countryRank: pos(b.sw_country_rank),
    category: text(b.sw_category),
    categoryRank: pos(b.sw_category_rank),
    coverage: text(b.sw_coverage),
    snapshotDate: isoDate(b.sw_snapshot_date),
  };
}

/** Display order of the traffic-source mix, with the API's key for each. */
const SOURCE_LABELS: [string, string][] = [
  ['direct', 'Direct'],
  ['organic_search', 'Organic search'],
  ['paid_search', 'Paid search'],
  ['organic_social', 'Organic social'],
  ['paid_social', 'Paid social'],
  ['referrals', 'Referrals'],
  ['email', 'Email'],
  ['affiliate', 'Affiliate'],
  ['display_ads', 'Display ads'],
  ['generative_ai', 'AI assistants'],
];

/** A 0–1 share as the 0–100 the bars draw, to one decimal. Absent stays absent. */
function share(v: unknown): number | null {
  const n = finite(v);
  if (n == null || n <= 0) return null;
  return Math.round(n * 1000) / 10;
}

function mapHistory(raw: unknown): Point[] {
  if (!Array.isArray(raw)) return [];
  const pts: Point[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const t = month(o.month);
    const v = pos(o.visits);
    if (!t || v == null) continue;          // a half-measured month is not a point
    pts.push({ t, v });
  }
  return pts.sort((a, b) => a.t.localeCompare(b.t));
}

function mapSources(raw: unknown): ShareRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  return SOURCE_LABELS
    .map(([key, label]) => ({ key, label, pct: share(o[key]) }))
    .filter((r): r is ShareRow => r.pct != null)
    .sort((a, b) => b.pct - a.pct);
}

function mapGeo(raw: unknown): CountryShare[] {
  if (!Array.isArray(raw)) return [];
  const out: CountryShare[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const code = text(o.code).toUpperCase().slice(0, 2);
    const pct = share(o.share);
    if (!code || pct == null) continue;
    out.push({ code, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

function mapKeywords(raw: unknown): SimilarWebKeyword[] {
  if (!Array.isArray(raw)) return [];
  const out: SimilarWebKeyword[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const keyword = text(o.keyword);
    if (!keyword) continue;                 // a keyword with no text is not a row
    out.push({
      keyword,
      volume: pos(o.volume),
      cpcUsd: pos(o.cpc_usd),
      valueUsd: pos(o.value_usd),
    });
  }
  return out;
}

/**
 * `similarweb_detail` from /top-brands/{id}. null when the key is absent — the
 * store has not been crawled — or when it carries no visit figure.
 */
export function mapDetail(raw: unknown, fallbackDomain = ''): SimilarWebDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const history = mapHistory(d.history);
  const visits = pos(d.visits) ?? (history.length ? history[history.length - 1].v : null);
  if (visits == null) return null;
  const prev = pos(d.prev_visits)
    ?? (history.length >= 2 ? history[history.length - 2].v : null);

  return {
    period: month(d.period) || (history.length ? history[history.length - 1].t : ''),
    visits,
    prevVisits: prev ?? 0,
    growthPct: finite(d.growth_pct),
    globalRank: pos(d.global_rank),
    countryCode: text(d.country_code).toUpperCase().slice(0, 2),
    countryRank: pos(d.country_rank),
    category: text(d.category),
    categoryRank: pos(d.category_rank),
    coverage: text(d.coverage),
    snapshotDate: isoDate(d.snapshot_date),
    domain: text(d.domain) || fallbackDomain,
    history,
    pagesPerVisit: pos(d.pages_per_visit),
    bounceRate: finite(d.bounce_rate),
    avgVisitSeconds: pos(d.avg_visit_seconds),
    sources: mapSources(d.sources),
    geo: mapGeo(d.geo),
    keywords: mapKeywords(d.keywords),
    aiReferralVisits: pos(d.ai_referral_visits),
    smallSite: d.small_site === true,
    fromGa: d.from_ga === true,
    fetchedAt: text(d.fetched_at),
  };
}

// ---------- labels ----------
// One wording for "this is measured" and one for "this is the index's guess",
// used by every surface so a reader never has to work out which number they are
// looking at.

/** "2026-08" → "Aug 2026". An unparseable month renders as itself. */
export function monthLabel(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return Number.isNaN(d.getTime()) ? period
    : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The month before `period`. SimilarWeb's site-overview history is consecutive
 * months ending at the measured period, so the month before "2026-08" is the
 * one `sw_prev_visits` counts. '' in, '' out — nothing is guessed from nothing.
 */
export function previousMonth(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return '';
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 7);
}

/** The short caption under a visit figure. */
export function trafficCaption(source: string | null, period = ''): string {
  if (source === 'similarweb') return period ? `SimilarWeb · ${monthLabel(period)}` : 'SimilarWeb';
  if (source === 'semrush') return 'Semrush';
  if (source === 'index') return 'Market index estimate';
  return '';
}

/** The long form, for a `title` attribute. */
export function trafficTitle(visits: number, source: string | null, period = '', domain = ''): string {
  const n = visits.toLocaleString();
  if (source === 'similarweb') {
    return `${n} visits${period ? ` in ${monthLabel(period)}` : ''}, measured by SimilarWeb`
      + `${domain ? ` for ${domain}` : ''}.`;
  }
  if (source === 'semrush') return `${n} monthly visits, from the licensed Semrush feed.`;
  return `${n} monthly visits — the market index's own estimate, which for a subdomain storefront`
    + ' is often the parent domain\'s traffic. It is replaced by a measured SimilarWeb figure'
    + ' when the crawl reaches this store.';
}

/**
 * The long form for a growth percentage, for a `title` attribute.
 *
 * Growth follows the visit figure's source by construction — a measured store
 * shows SimilarWeb's month-over-month or nothing at all, never the index's rate
 * beside a measured figure — so this wording matches `trafficTitle` and the two
 * can never claim different sources for the same row.
 */
export function growthTitle(growthPct: number, source: string | null, period = '', domain = ''): string {
  const n = `${growthPct > 0 ? '+' : ''}${growthPct.toFixed(1)}%`;
  if (source === 'similarweb') {
    const prev = previousMonth(period);
    const span = prev && period ? ` (${monthLabel(prev)} \u2192 ${monthLabel(period)})` : '';
    return `${n} month over month${span}, measured by SimilarWeb${domain ? ` for ${domain}` : ''}.`;
  }
  if (source === 'semrush') return `${n} month over month, from the licensed Semrush feed.`;
  return `${n} — the market index's own growth rate for this store, not a measurement of this host.`
    + ' It is replaced by SimilarWeb\u2019s measured change when the crawl reaches this store.';
}

/** "lifestyle/fashion_and_apparel" → "Lifestyle › Fashion and apparel". */
export function categoryLabel(slug: string): string {
  return slug
    .split('/')
    .map(part => {
      const words = part.replace(/_/g, ' ').trim();
      return words ? words[0].toUpperCase() + words.slice(1) : '';
    })
    .filter(Boolean)
    .join(' › ');
}

/** 214 → "3m 34s". Seconds alone below a minute. */
export function durationLabel(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}
