// Alerts digest: pure logic (no DB, no network), shared by the saved-search
// UI, the nightly job (scripts/alerts-digest.mjs) and tests/alerts.test.mjs.
//
// What counts as news is decided here once: a tracked brand is in the digest
// only when its Brandtracker window delta (lib/tracker-window.ts, the same
// numbers the /brandtracker board shows) moved materially, and a saved search
// only when it has results the user was never shown. No change = no email.
import type { WindowDelta } from '../tracker-window';

export type AlertFrequency = 'daily' | 'weekly' | 'off';
export type SearchKind = 'shops' | 'ads';

export const FREQUENCIES: AlertFrequency[] = ['daily', 'weekly', 'off'];
export const isFrequency = (v: unknown): v is AlertFrequency => FREQUENCIES.includes(v as AlertFrequency);
export const isSearchKind = (v: unknown): v is SearchKind => v === 'shops' || v === 'ads';

/** Monthly-visits moves smaller than this are noise in a monthly estimate. */
export const VISITS_MATERIAL_PCT = 10;
/** Most results listed per saved search in one email; the rest are a link. */
export const ITEMS_PER_SEARCH = 5;
/** Remembered result ids per saved search (newest kept). */
export const SEEN_CAP = 1000;
export const MAX_SAVED_SEARCHES = 100;
/** Default for a user who never chose (owner decision 2026-09-27: daily for everyone). */
export const DEFAULT_FREQUENCY: AlertFrequency = 'daily';

// ---------- Today in the market ----------
/** A day-over-day rise in running Meta ads below this is not news. */
export const MARKET_MIN_JUMP = 100;
/** Fewer qualifying stores than this and the section is left out that day. */
export const MARKET_MIN_ROWS = 3;
export const MARKET_ROWS = 5;

export interface MarketMover {
  shopId: string; name: string; domain: string;
  /** https logo URL, or '' — then no image is drawn. */
  logo: string;
  niches: string[];
  before: number; after: number; jump: number;
}

/**
 * The market rows for one user: movers in the user's own niches when there are
 * enough of them, else the biggest movers overall. null = nothing material.
 */
export function marketPicks(movers: MarketMover[], userNiches: string[]): { niche: string | null; items: MarketMover[] } | null {
  const good = movers.filter(m => m.jump >= MARKET_MIN_JUMP).sort((a, b) => b.jump - a.jump);
  for (const niche of userNiches) {
    const inNiche = good.filter(m => m.niches.includes(niche));
    if (inNiche.length >= MARKET_MIN_ROWS) return { niche, items: inNiche.slice(0, MARKET_ROWS) };
  }
  return good.length >= MARKET_MIN_ROWS ? { niche: null, items: good.slice(0, MARKET_ROWS) } : null;
}

/** A user's niches, most frequent first, from the stores they track or saved. */
export function topNiches(nicheLists: string[][], n = 3): string[] {
  const count = new Map<string, number>();
  for (const list of nicheLists) for (const x of new Set(list)) if (x) count.set(x, (count.get(x) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

// Query keys that are navigation or attribution, never part of a search.
const DROP = /^(page|ref|fbclid|gclid|utm_.*)$/;

/**
 * Canonical query string for a saved search: no page/attribution, no empty
 * values, keys sorted, so the same filters saved twice are the same search.
 */
export function normalizeQuery(qs: string): string {
  const src = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  const out = new URLSearchParams();
  const keys = [...new Set([...src.keys()])].filter(k => k.length <= 40 && !DROP.test(k)).sort();
  for (const k of keys) {
    const v = src.get(k)?.trim();
    if (v) out.set(k, v.slice(0, 300));
  }
  return out.toString();
}

/** The query as a Record, the shape the page loaders read. */
export function queryParams(qs: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(qs));
}

const LABEL: Record<string, string> = {
  q: 'Search', country: 'Country', platform: 'Platform', category: 'Category', subcategory: 'Subcategory',
  traffic: 'Traffic', growth: 'Growth', created: 'Created', pixel: 'Pixel', tech: 'Tech', sort: 'Sort', dir: 'Order',
  visitorCountry: 'Visitors from', media: 'Media', format: 'Format', placement: 'Placement', niche: 'Niche',
  store: 'Store', from: 'From', to: 'To', euUk: 'EU/UK', hook: 'Hook', angle: 'Angle', funnelStage: 'Funnel',
  offer: 'Offer', urgency: 'Urgency', productsMin: 'Products ≥', productsMax: 'Products ≤',
  avgPriceMin: 'Avg price ≥', avgPriceMax: 'Avg price ≤', viewed: 'Viewed', tracked: 'Tracked', hidden: 'Hidden', view: 'View',
};

/** "Search: shoes · Country: US" — the filter set in words; '' = no filters. */
export function describeQuery(qs: string): string {
  return [...new URLSearchParams(qs)].map(([k, v]) => `${LABEL[k] ?? k}: ${v}`).join(' · ');
}

/** Result ids the user has not been shown, in result order. */
export function newResultIds(current: string[], seen: string[] | null): string[] {
  if (!seen) return [];                 // not seeded: everything is the baseline
  const s = new Set(seen);
  return current.filter(id => !s.has(id));
}

/** seen ∪ current, newest first, capped. */
export function mergeSeen(seen: string[] | null, current: string[], cap = SEEN_CAP): string[] {
  return [...new Set([...current, ...(seen ?? [])])].slice(0, cap);
}

/** Which period a digest covers; null = this user gets nothing today. */
export function periodFor(freq: AlertFrequency, dayIso: string, isoWeekKey: string, isMonday: boolean): string | null {
  if (freq === 'daily') return `d:${dayIso}`;
  if (freq === 'weekly') return isMonday ? `w:${isoWeekKey}` : null;
  return null;
}

const fmt = (n: number) => Math.abs(n).toLocaleString('en-US');
const signed = (n: number) => `${n > 0 ? '+' : '−'}${fmt(n)}`;

/** The material moves in one brand's window delta, as short lines. [] = nothing to report. */
export function trackerLines(d: WindowDelta): string[] {
  const out: string[] = [];
  if (d.newAds !== null && d.newAds > 0) out.push(`${fmt(d.newAds)} new ad${d.newAds === 1 ? '' : 's'} launched`);
  if (d.liveAds !== null && d.liveAds !== 0) out.push(`Live ads ${signed(d.liveAds)}`);
  if (d.visits !== null && d.visitsPct !== null && Math.abs(d.visitsPct) >= VISITS_MATERIAL_PCT) {
    out.push(`Monthly visits ${signed(d.visits)} (${d.visitsPct > 0 ? '+' : '−'}${Math.abs(d.visitsPct)}%)`);
  }
  if (d.products !== null && d.products > 0) out.push(`${fmt(d.products)} new product${d.products === 1 ? '' : 's'}`);
  else if (d.products !== null && d.products < 0) out.push(`${fmt(d.products)} product${d.products === -1 ? '' : 's'} removed`);
  return out;
}

export interface DigestBrand { shopId: string; name: string; domain: string; lines: string[] }
export interface DigestItem { title: string; subtitle: string; href: string }
export interface DigestSearch { id: string; name: string; kind: SearchKind; query: string; items: DigestItem[]; total: number }

export interface Digest { subject: string; heading: string; body: string; cta: { label: string; href: string } }

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The email for one user and period, or null when there is nothing to say. */
export function buildDigest(o: {
  app: string; frequency: 'daily' | 'weekly'; brands: DigestBrand[]; searches: DigestSearch[];
  market?: { niche: string | null; items: MarketMover[] } | null;
}): Digest | null {
  const brands = o.brands.filter(b => b.lines.length);
  const searches = o.searches.filter(s => s.total > 0 && s.items.length);
  const market = o.market && o.market.items.length ? o.market : null;
  if (!brands.length && !searches.length && !market) return null;
  const app = o.app.replace(/\/$/, '');
  const ref = `ref=alerts:${o.frequency}`;
  const link = 'color:#4338ca;text-decoration:none;font-weight:600';
  const sub = 'color:#6b7280;font-size:12px';
  const row = 'padding:6px 0;border-bottom:1px solid #f3f4f6';
  const parts: string[] = [];

  if (brands.length) {
    parts.push(`<p style="margin:0 0 6px;font-weight:600;color:#111827">Brandtracker · ${o.frequency === 'daily' ? 'last 24 hours' : 'last 7 days'}</p>`);
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">');
    for (const b of brands) {
      parts.push(`<tr><td style="${row}"><a href="${app}/shops/${encodeURIComponent(b.shopId)}?${ref}" style="${link}">${esc(b.name || b.domain)}</a>`
        + `<br><span style="${sub}">${esc(b.domain)}</span><br><span style="font-size:13px;color:#374151">${b.lines.map(esc).join(' · ')}</span></td></tr>`);
    }
    parts.push('</table>');
  }
  for (const s of searches) {
    const url = `${app}/${s.kind}${s.query ? `?${s.query}&${ref}` : `?${ref}`}`;
    parts.push(`<p style="margin:20px 0 6px;font-weight:600;color:#111827">${esc(s.name)} · ${fmt(s.total)} new ${s.kind === 'shops' ? (s.total === 1 ? 'shop' : 'shops') : (s.total === 1 ? 'ad' : 'ads')}</p>`);
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">');
    for (const it of s.items.slice(0, ITEMS_PER_SEARCH)) {
      parts.push(`<tr><td style="${row}"><a href="${app}${it.href}${it.href.includes('?') ? '&' : '?'}${ref}" style="${link}">${esc(it.title)}</a>`
        + (it.subtitle ? `<br><span style="${sub}">${esc(it.subtitle)}</span>` : '') + '</td></tr>');
    }
    parts.push('</table>');
    if (s.total > ITEMS_PER_SEARCH) parts.push(`<p style="margin:6px 0 0;font-size:13px"><a href="${url}" style="${link}">See all ${fmt(s.total)} in ${s.kind === 'shops' ? 'Shops' : 'Ads'} →</a></p>`);
  }

  if (market) {
    // After the user's own news, never before it.
    const lead = parts.length ? 'margin:24px 0 6px' : 'margin:0 0 6px';
    parts.push(`<p style="${lead};font-weight:600;color:#111827">Today in the market${market.niche ? ` · ${esc(market.niche)}` : ''}</p>`);
    parts.push(`<p style="margin:0 0 6px;${sub}">Stores that added the most live Meta ads yesterday.</p>`);
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">');
    for (const m of market.items) {
      // No logo = no image cell at all, never a blank box.
      const img = m.logo
        ? `<td width="36" style="${row};padding-right:10px;vertical-align:top"><img src="${esc(m.logo)}" width="28" height="28" alt="" style="display:block;border-radius:6px;border:1px solid #e5e7eb"></td>`
        : '';
      parts.push(`<tr>${img}<td style="${row}"${m.logo ? '' : ' colspan="2"'}><a href="${app}/shops/${encodeURIComponent(m.shopId)}?${ref}" style="${link}">${esc(m.name)}</a>`
        + `<br><span style="${sub}">${esc(m.domain)} · ${fmt(m.before)} → ${fmt(m.after)} live ads</span></td>`
        + `<td style="${row};padding-left:12px;text-align:right;white-space:nowrap;font-weight:600;color:#047857;vertical-align:top">+${fmt(m.jump)}</td></tr>`);
    }
    parts.push('</table>');
  }

  const newResults = searches.reduce((n, s) => n + s.total, 0);
  const bits = [
    brands.length ? `${fmt(brands.length)} tracked brand${brands.length === 1 ? '' : 's'} moved` : '',
    newResults ? `${fmt(newResults)} new result${newResults === 1 ? '' : 's'} in your saved searches` : '',
  ].filter(Boolean);
  // Personal news leads the subject; a market-only digest names its biggest mover.
  const subject = bits.length
    ? bits.join(', ')
    : `${market!.items[0].name} added ${fmt(market!.items[0].jump)} live Meta ads yesterday`;
  const personal = brands.length || searches.length;
  return {
    subject: subject[0].toUpperCase() + subject.slice(1),
    heading: personal
      ? (o.frequency === 'daily' ? 'Your daily AdLibrarySpy alerts' : 'Your weekly AdLibrarySpy alerts')
      : (o.frequency === 'daily' ? 'Your daily market brief' : 'Your weekly market brief'),
    body: parts.join(''),
    cta: brands.length
      ? { label: 'Open Brandtracker', href: `${app}/brandtracker?window=${o.frequency === 'daily' ? '1d' : '7d'}&${ref}` }
      : searches.length
        ? { label: 'Open saved searches', href: `${app}/searches?${ref}` }
        : { label: 'Explore scaling stores', href: `${app}/shops?${ref}` },
  };
}
