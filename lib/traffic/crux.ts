// Chrome UX Report popularity ranks.
//
// CrUX is real-user Chrome telemetry, published monthly by Google. The research
// the dumps repository cites finds it materially more accurate at capturing the
// set of popular sites than Alexa or Tranco, which is why it is the reliable
// signal here — the store index's own `monthly_traffic` disagrees with observed
// reality often enough that it cannot be presented on its own.
//
// A CrUX rank is a MAGNITUDE BAND, not a position. "Top 100K" means the origin
// sits somewhere in the 50,001–100,000 band. Google does not publish an exact
// ordinal, so this never invents one.
import { query, one } from '@/lib/db';
import type { CruxRank } from './crux-bands';

export * from './crux-bands';

let LOADED_MONTH: string | null | undefined;

/** The CrUX month currently loaded, or null if the table is empty. */
export async function cruxMonth(): Promise<string | null> {
  if (LOADED_MONTH !== undefined) return LOADED_MONTH;
  try {
    const row = await one<{ month: string }>(
      'SELECT month FROM crux_import WHERE finished_at IS NOT NULL ORDER BY month DESC LIMIT 1');
    LOADED_MONTH = row?.month ?? null;
  } catch {
    LOADED_MONTH = null;
  }
  return LOADED_MONTH;
}

/** Ranks for a page of domains. Absent domains are simply not in the map. */
export async function cruxRanks(domains: string[]): Promise<Map<string, CruxRank>> {
  const out = new Map<string, CruxRank>();
  const list = [...new Set(domains.filter(Boolean))];
  if (!list.length) return out;
  try {
    // Page domains are random and rarely cached: each costs a ~10ms storage
    // read, and one ANY($1) statement makes 25 of them in a row (~280ms).
    // Five-domain statements side by side overlap that I/O.
    const parts: string[][] = [];
    for (let i = 0; i < list.length; i += 5) parts.push(list.slice(i, i + 5));
    const rows = (await Promise.all(parts.map(p => query<{ domain: string; rank_bucket: number; month: string }>(
      'SELECT domain, rank_bucket, month FROM crux_rank WHERE domain = ANY($1)', [p])))).flat();
    for (const r of rows) out.set(r.domain, { domain: r.domain, bucket: r.rank_bucket, month: r.month });
  } catch {
    // Table not imported yet — callers render nothing rather than a fake rank.
  }
  return out;
}

export async function cruxRank(domain: string): Promise<CruxRank | null> {
  if (!domain) return null;
  return (await cruxRanks([domain])).get(domain) ?? null;
}
