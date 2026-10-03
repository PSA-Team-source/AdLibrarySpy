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
/** Live ads must move by at least this much (or start from zero) to be emailed. */
export const LIVE_ADS_MATERIAL_PCT = 50;
/** Fewer newly indexed creatives than this in the window is a trickle, not a launch. */
export const TRACKER_MIN_NEW_ADS = 3;
/** Product-count moves smaller than this are catalogue jitter (a variant re-listed). */
export const TRACKER_MIN_PRODUCTS = 2;
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

// ---------- Winning products today (lib/alerts/products.ts) ----------
/** A product needs at least this many new ads in the 48h window to be listed. */
export const PRODUCTS_MIN_NEW_ADS = 10;
/** Most "track a store you viewed" suggestions in one email. */
export const SUGGESTIONS = 3;

export interface WinningToday {
  title: string;
  /** https raster image, or '' — then no image is drawn. */
  image: string;
  shopId: string; storeName: string; domain: string;
  /** Distinct new Meta ads started from `from` through `to` (UTC dates). */
  newAds: number; from: string; to: string;
  niches?: string[];
}

// ---------- Today's 10 winners (persisted per day in winner_days; /winners archive) ----------
/** The daily list is always this long when the market has that many real winners. */
export const WINNERS = 10;
/** Fewer than this and there is no list that day (and no section in the email). */
export const WINNERS_MIN = 3;
/** Candidates resolved once per run, so niche lists can still fill 10. */
export const WINNERS_POOL = 80;

/**
 * The day's ranked list for one user: their first niche that can fill all
 * WINNERS places, else the overall top. Never padded: a thin day lists fewer.
 */
export function winnersFor(pool: WinningToday[], userNiches: string[]): { niche: string | null; items: WinningToday[] } {
  for (const niche of userNiches) {
    const inNiche = pool.filter(p => p.niches?.includes(niche));
    if (inNiche.length >= WINNERS) return { niche, items: inNiche.slice(0, WINNERS) };
  }
  return { niche: null, items: pool.slice(0, WINNERS) };
}

/** "Today's 10 winners" — the count is the real list length. */
export const winnersTitle = (n: number) => `Today's ${n === 1 ? 'winner' : `${n} winners`}`;

/** Archive URL of one day's list (niche lists carry ?niche=). */
export function winnersPath(day: string, niche: string | null): string {
  return `/winners/${day}${niche ? `?niche=${encodeURIComponent(niche)}` : ''}`;
}

/** Daily emails in a row with no click before a default-daily user drops to weekly. */
export const QUIET_AFTER = 14;

/**
 * Frequency for this run: a user who never chose and has ignored QUIET_AFTER
 * daily emails gets the weekly one instead (one click puts them back on daily).
 * An explicit choice is always kept.
 */
export function effectiveFrequency(freq: AlertFrequency, chosen: boolean, sendsSinceClick: number): AlertFrequency {
  return !chosen && freq === 'daily' && sendsSinceClick >= QUIET_AFTER ? 'weekly' : freq;
}

/** A shop the user opened, offered as a first tracker. */
export interface Suggestion { shopId: string; name: string }

/** "Sep 29–30" / "Sep 30 – Oct 1": the window a count covers, in words. */
export function dayRange(from: string, to: string): string {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${M[tm - 1]} ${td}`;
  return fm === tm ? `${M[fm - 1]} ${fd}–${td}` : `${M[fm - 1]} ${fd} – ${M[tm - 1]} ${td}`;
}

/** Up to SUGGESTIONS distinct viewed shops the user does not track yet, most recent first. */
export function pickSuggestions(viewed: Suggestion[], tracked: Iterable<string> = []): Suggestion[] {
  const skip = new Set(tracked);
  const out: Suggestion[] = [];
  for (const v of viewed) {
    if (!v.shopId || skip.has(v.shopId)) continue;
    skip.add(v.shopId);
    out.push(v);
    if (out.length >= SUGGESTIONS) break;
  }
  return out;
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
  offer: 'Offer', style: 'Video style', urgency: 'Urgency', productsMin: 'Products ≥', productsMax: 'Products ≤',
  avgPriceMin: 'Avg price ≥', avgPriceMax: 'Avg price ≤', viewed: 'Viewed', tracked: 'Tracked', hidden: 'Hidden', view: 'View',
  minTraffic: 'Traffic ≥', maxTraffic: 'Traffic ≤', minProducts: 'Products ≥', maxProducts: 'Products ≤',
  minPrice: 'Price ≥ $', maxPrice: 'Price ≤ $', minAds: 'Ads ≥', maxAds: 'Ads ≤',
  creationCountry: 'Shop origin', excludeCreationCountry: 'Not from', minDate: 'Created after', maxDate: 'Created before',
  nicheSub: 'Sub-niche', language: 'Language', currency: 'Currency', theme: 'Theme', social: 'Socials', app: 'App',
  excludeApp: 'Without app', excludePixel: 'Without pixel', plan: 'Shopify plan',
  minRating: 'Trustpilot ≥', maxRating: 'Trustpilot ≤', minReviews: 'Reviews ≥', maxReviews: 'Reviews ≤',
};

/** Growth rules (`1m:gt:20,and:6m:lt:-10`) in words; older single values pass through. */
const growthWords = (v: string) => v.split(',').map(p => p
  .replace(/^(and|or):/, '$1 ').replace(/(\d)m:gt:(-?[\d.]+)/, '$1 mo > $2%').replace(/(\d)m:lt:(-?[\d.]+)/, '$1 mo < $2%')).join(' ');

/** "Search: shoes · Country: US" — the filter set in words; '' = no filters. */
export function describeQuery(qs: string): string {
  return [...new URLSearchParams(qs)].map(([k, v]) => `${LABEL[k] ?? k}: ${k === 'growth' ? growthWords(v) : v.split('|').join(', ')}`).join(' · ');
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
  if (d.newAds !== null && d.newAds >= TRACKER_MIN_NEW_ADS) out.push(`${fmt(d.newAds)} new ad${d.newAds === 1 ? '' : 's'} launched`);
  // Small day-to-day swings in live ads are noise; a jump (or drop) of 50%+,
  // or going live from zero, is news. liveAdsPct null + liveAds > 0 = from zero.
  if (d.liveAds !== null && d.liveAds !== 0) {
    const pct = d.liveAdsPct;
    if (pct !== null && Math.abs(pct) >= LIVE_ADS_MATERIAL_PCT) out.push(`Live ads ${signed(d.liveAds)} (${pct > 0 ? '+' : '−'}${Math.abs(pct)}%)`);
    else if (pct === null && d.liveAds > 0) out.push(`Live ads ${signed(d.liveAds)} (went live)`);
  }
  if (d.visits !== null && d.visitsPct !== null && Math.abs(d.visitsPct) >= VISITS_MATERIAL_PCT) {
    out.push(`Monthly visits ${signed(d.visits)} (${d.visitsPct > 0 ? '+' : '−'}${Math.abs(d.visitsPct)}%)`);
  }
  if (d.newLandingPages != null && d.newLandingPages > 0) out.push(`${fmt(d.newLandingPages)} new landing page${d.newLandingPages === 1 ? '' : 's'}`);
  if (d.products !== null && d.products >= TRACKER_MIN_PRODUCTS) out.push(`${fmt(d.products)} new products`);
  else if (d.products !== null && d.products <= -TRACKER_MIN_PRODUCTS) out.push(`${fmt(d.products)} product${d.products === -1 ? '' : 's'} removed`);
  return out;
}

export interface DigestBrand { shopId: string; name: string; domain: string; lines: string[] }
export interface DigestItem { title: string; subtitle: string; href: string }
export interface DigestSearch { id: string; name: string; kind: SearchKind; query: string; items: DigestItem[]; total: number }

export interface Digest { subject: string; heading: string; body: string; cta: { label: string; href: string } }

/** "1 of your shops changed" / "3 of your shops changed". */
export const shopsChanged = (n: number) => `${fmt(n)} of your shops changed`;

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The email for one user and period, or null when there is nothing to say. */
export function buildDigest(o: {
  app: string; frequency: 'daily' | 'weekly'; brands: DigestBrand[]; searches: DigestSearch[];
  market?: { niche: string | null; items: MarketMover[] } | null;
  /**
   * Today's ranked winners (winner_days: the same list /winners/<day> shows).
   * Under WINNERS_MIN it is left out. niche = the list was picked for it; null = overall.
   */
  winners?: { day: string; niche: string | null; items: WinningToday[] } | null;
  /** Set for a user who tracks nothing: the activation nudge. Never a reason to send on its own. */
  nudge?: { suggestions: Suggestion[] } | null;
}): Digest | null {
  const brands = o.brands.filter(b => b.lines.length);
  const searches = o.searches.filter(s => s.total > 0 && s.items.length);
  const market = o.market && o.market.items.length ? o.market : null;
  const personal = brands.length > 0 || searches.length > 0;
  const winners = o.winners && o.winners.items.length >= WINNERS_MIN ? { ...o.winners, items: o.winners.items.slice(0, WINNERS) } : null;
  if (!personal && !market && !winners) return null;
  const app = o.app.replace(/\/$/, '');
  const ref = `ref=alerts:${o.frequency}`;
  const link = 'color:#4338ca;text-decoration:none;font-weight:600';
  const sub = 'color:#6b7280;font-size:12px';
  const row = 'padding:6px 0;border-bottom:1px solid #f3f4f6';
  const parts: string[] = [];

  if (brands.length) {
    // The user's own shops lead the email, always.
    parts.push(`<p style="margin:0 0 6px;font-weight:600;color:#111827">${shopsChanged(brands.length)} · ${o.frequency === 'daily' ? 'last 24 hours' : 'last 7 days'}</p>`);
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

  if (winners) {
    const lead = parts.length ? 'margin:24px 0 6px' : 'margin:0 0 6px';
    const all = `${app}${winnersPath(winners.day, winners.niche)}${winners.niche ? '&' : '?'}${ref}`;
    parts.push(`<p style="${lead};font-weight:600;color:#111827">${winnersTitle(winners.items.length)}${winners.niche ? ` · ${esc(winners.niche)}` : ''}</p>`);
    parts.push(`<p style="margin:0 0 6px;${sub}">Shopify products with the most new Meta ads started ${esc(dayRange(winners.items[0].from, winners.items[0].to))} (UTC), one per store.</p>`);
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">');
    winners.items.forEach((p, i) => {
      // No image = no image cell at all, never a blank box.
      const img = p.image
        ? `<td width="52" style="${row};padding-right:10px;vertical-align:top"><img src="${esc(p.image)}" width="44" height="44" alt="" style="display:block;border-radius:6px;border:1px solid #e5e7eb;object-fit:cover"></td>`
        : '';
      parts.push(`<tr><td width="24" style="${row};vertical-align:top;color:#6b7280;font-weight:600">${i + 1}</td>${img}<td style="${row}"${p.image ? '' : ' colspan="2"'}><a href="${app}/shops/${encodeURIComponent(p.shopId)}?${ref}" style="${link}">${esc(p.title)}</a>`
        + `<br><span style="${sub}">${esc(p.storeName)} · ${esc(p.domain)} · </span><a href="${app}/shops/${encodeURIComponent(p.shopId)}?track=1&${ref}" style="${link};font-size:12px">Track store</a></td>`
        + `<td style="${row};padding-left:12px;text-align:right;white-space:nowrap;vertical-align:top"><span style="font-weight:600;color:#047857">+${fmt(p.newAds)}</span><br><span style="${sub}">new ads</span></td></tr>`);
    });
    parts.push('</table>');
    parts.push(`<p style="margin:6px 0 0;font-size:13px"><a href="${all}" style="${link}">Open today's list and past days →</a></p>`);
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
        + `<br><span style="${sub}">${esc(m.domain)} · ${fmt(m.before)} → ${fmt(m.after)} live ads · </span><a href="${app}/shops/${encodeURIComponent(m.shopId)}?track=1&${ref}" style="${link};font-size:12px">Track store</a></td>`
        + `<td style="${row};padding-left:12px;text-align:right;white-space:nowrap;font-weight:600;color:#047857;vertical-align:top">+${fmt(m.jump)}</td></tr>`);
    }
    parts.push('</table>');
  }

  if (o.nudge) {
    const box = 'margin:24px 0 0;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb';
    const sugg = o.nudge.suggestions.slice(0, SUGGESTIONS);
    const list = sugg.length
      ? `<p style="margin:8px 0 0;font-size:13px;color:#374151">Stores you looked at: ${sugg.map(s =>
          `<a href="${app}/shops/${encodeURIComponent(s.shopId)}?track=1&${ref}" style="${link}">Track ${esc(s.name)}</a>`).join(' · ')}</p>`
      : `<p style="margin:8px 0 0;font-size:13px"><a href="${app}/shops?${ref}" style="${link}">Find a store to track →</a></p>`;
    parts.push(`<div style="${box}"><p style="margin:0;font-weight:600;color:#111827">Track a competitor to get alerts when they launch products or ads</p>${list}</div>`);
  }

  const newResults = searches.reduce((n, s) => n + s.total, 0);
  const bits = [
    brands.length ? shopsChanged(brands.length) : '',
    newResults ? `${fmt(newResults)} new result${newResults === 1 ? '' : 's'} in your saved searches` : '',
  ].filter(Boolean);
  // Personal news leads the subject; a market-only digest names its biggest mover.
  const subject = bits.length
    ? bits.join(', ')
    : winners
      ? `${winnersTitle(winners.items.length)}${winners.niche ? ` in ${winners.niche}` : ''}: ${winners.items[0].title.slice(0, 60)} leads with ${fmt(winners.items[0].newAds)} new ads`
      : `${market!.items[0].name} added ${fmt(market!.items[0].jump)} live Meta ads yesterday`;
  return {
    subject: subject[0].toUpperCase() + subject.slice(1),
    heading: personal
      ? (o.frequency === 'daily' ? 'Your daily AdLibrarySpy alerts' : 'Your weekly AdLibrarySpy alerts')
      : (o.frequency === 'daily' ? 'Your daily market brief' : 'Your weekly market brief'),
    body: parts.join(''),
    cta: brands.length
      ? { label: 'Open your tracked shops', href: `${app}/brandtracker?window=${o.frequency === 'daily' ? '1d' : '7d'}&${ref}` }
      : searches.length
        ? { label: 'Open saved searches', href: `${app}/searches?${ref}` }
        : winners
          ? { label: `See ${winnersTitle(winners.items.length).replace(/^Today's /, 'all ')}`, href: `${app}${winnersPath(winners.day, winners.niche)}${winners.niche ? '&' : '?'}${ref}` }
          : { label: 'Explore scaling stores', href: `${app}/shops?${ref}` },
  };
}
