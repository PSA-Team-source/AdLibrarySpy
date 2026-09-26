// Licensed traffic data.
//
// HARD RULE: this module never invents a number. A domain we have no licensed
// measurement for returns `null`, and the UI renders no chart at all. The
// previous implementation synthesised history (linear interpolation + random
// noise) and modelled visits from ad/social counts; both are gone.
//
// Providers are configured by TRAFFIC_PROVIDER + the matching API key. With no
// key set, `monthlyTraffic()` returns null for every domain — correct and
// honest, just empty, until a contract is in place.
import { query, one } from '@/lib/db';

export type TrafficSource = 'similarweb' | 'semrush';

export interface TrafficPoint { month: string; visits: number }
export interface TrafficSeries {
  domain: string;
  source: TrafficSource;
  points: TrafficPoint[];
  latest: number;
  /** Month-over-month change of the last two measured points, or null if <2. */
  changePct: number | null;
  fetchedAt: Date;
}

const CACHE_DAYS = Number(process.env.TRAFFIC_CACHE_DAYS || 7);
const MONTHS = 12;

export function trafficProvider(): TrafficSource | null {
  const p = (process.env.TRAFFIC_PROVIDER || '').trim().toLowerCase();
  if (p === 'similarweb' && process.env.SIMILARWEB_API_KEY) return 'similarweb';
  if (p === 'semrush' && process.env.SEMRUSH_API_KEY) return 'semrush';
  return null;
}

export function trafficConfigured(): boolean {
  return trafficProvider() !== null;
}

// ---------- cache ----------
async function readCache(domain: string, source: TrafficSource): Promise<TrafficSeries | null> {
  const fresh = await one<{ fetched_at: Date }>(
    `SELECT fetched_at FROM traffic_fetch_log
      WHERE domain = $1 AND source = $2 AND fetched_at > now() - ($3 || ' days')::interval`,
    [domain, source, String(CACHE_DAYS)],
  );
  if (!fresh) return null;

  const rows = await query<{ month: Date; visits: string }>(
    `SELECT month, visits FROM traffic_monthly
      WHERE domain = $1 AND source = $2 ORDER BY month ASC`,
    [domain, source],
  );
  if (!rows.length) return null;         // logged as no_coverage
  return toSeries(domain, source, rows.map(r => ({
    month: r.month.toISOString().slice(0, 7),
    visits: Number(r.visits),
  })), fresh.fetched_at);
}

async function writeCache(domain: string, source: TrafficSource, points: TrafficPoint[]): Promise<void> {
  for (const p of points) {
    await query(
      `INSERT INTO traffic_monthly (domain, month, visits, source) VALUES ($1, ($2 || '-01')::date, $3, $4)
       ON CONFLICT (domain, month, source) DO UPDATE SET visits = EXCLUDED.visits, fetched_at = now()`,
      [domain, p.month, p.visits, source],
    );
  }
}

async function logFetch(domain: string, source: TrafficSource, outcome: 'ok' | 'no_coverage' | 'error' | 'quota', detail?: string) {
  await query(
    `INSERT INTO traffic_fetch_log (domain, source, outcome, detail) VALUES ($1,$2,$3,$4)
     ON CONFLICT (domain, source) DO UPDATE SET fetched_at = now(), outcome = EXCLUDED.outcome, detail = EXCLUDED.detail`,
    [domain, source, outcome, detail ?? null],
  ).catch(() => {});
}

function toSeries(domain: string, source: TrafficSource, points: TrafficPoint[], fetchedAt: Date): TrafficSeries {
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted.length ? sorted[sorted.length - 1].visits : 0;
  let changePct: number | null = null;
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2].visits;
    if (prev > 0) changePct = Math.round(((latest - prev) / prev) * 100);
  }
  return { domain, source, points: sorted, latest, changePct, fetchedAt };
}

// ---------- providers ----------
// SimilarWeb: GET /v1/website/{domain}/total-traffic-and-engagement/visits
async function fetchSimilarWeb(domain: string): Promise<TrafficPoint[] | null> {
  const key = process.env.SIMILARWEB_API_KEY!;
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - MONTHS, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const url = `https://api.similarweb.com/v1/website/${encodeURIComponent(domain)}/total-traffic-and-engagement/visits`
    + `?api_key=${encodeURIComponent(key)}&start_date=${fmt(start)}&end_date=${fmt(end)}`
    + `&country=world&granularity=monthly&main_domain_only=false&format=json`;

  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;                       // no coverage
  if (res.status === 429) throw new Error('quota');
  if (!res.ok) throw new Error(`similarweb ${res.status}`);
  const body = (await res.json()) as { visits?: { date: string; visits: number }[] };
  const pts = (body.visits || [])
    .filter(v => typeof v.visits === 'number' && v.visits > 0)
    .map(v => ({ month: v.date.slice(0, 7), visits: Math.round(v.visits) }));
  return pts.length ? pts : null;
}

// Semrush: domain_rank_history (analytics API), organic+paid traffic per month.
async function fetchSemrush(domain: string): Promise<TrafficPoint[] | null> {
  const key = process.env.SEMRUSH_API_KEY!;
  const url = `https://api.semrush.com/analytics/ta/api/v3/summary`
    + `?key=${encodeURIComponent(key)}&targets=${encodeURIComponent(domain)}&export_columns=target,visits&display_date=`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 429) throw new Error('quota');
  if (!res.ok) throw new Error(`semrush ${res.status}`);
  const text = await res.text();
  // CSV: header line then rows, ';' separated.
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  const cols = lines[0].split(';').map(s => s.trim());
  const iVisits = cols.indexOf('visits');
  const iDate = cols.indexOf('display_date');
  if (iVisits < 0) return null;
  const pts: TrafficPoint[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(';');
    const v = Number(f[iVisits]);
    const m = iDate >= 0 ? String(f[iDate]).slice(0, 7) : null;
    if (m && Number.isFinite(v) && v > 0) pts.push({ month: m, visits: Math.round(v) });
  }
  return pts.length ? pts : null;
}

/**
 * Licensed monthly traffic for a domain, or null when we have no measurement.
 * Null is a valid, expected answer — callers must render nothing, not a zero.
 */
export async function monthlyTraffic(domain: string): Promise<TrafficSeries | null> {
  const source = trafficProvider();
  if (!source) return null;
  const d = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!d || !d.includes('.')) return null;

  const cached = await readCache(d, source);
  if (cached) return cached;

  try {
    const pts = source === 'similarweb' ? await fetchSimilarWeb(d) : await fetchSemrush(d);
    if (!pts) { await logFetch(d, source, 'no_coverage'); return null; }
    await writeCache(d, source, pts);
    await logFetch(d, source, 'ok');
    return toSeries(d, source, pts, new Date());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logFetch(d, source, msg === 'quota' ? 'quota' : 'error', msg);
    // Serve a stale cached series rather than nothing when the provider is down.
    const stale = await query<{ month: Date; visits: string }>(
      `SELECT month, visits FROM traffic_monthly WHERE domain = $1 AND source = $2 ORDER BY month ASC`,
      [d, source],
    );
    if (stale.length) {
      return toSeries(d, source, stale.map(r => ({ month: r.month.toISOString().slice(0, 7), visits: Number(r.visits) })), new Date(0));
    }
    return null;
  }
}

/** Batch helper for list views — bounded concurrency, never throws. */
export async function monthlyTrafficMany(domains: string[], concurrency = 6): Promise<Map<string, TrafficSeries>> {
  const out = new Map<string, TrafficSeries>();
  if (!trafficConfigured()) return out;
  const queue = [...new Set(domains)];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const d = queue.shift();
      if (!d) return;
      const s = await monthlyTraffic(d).catch(() => null);
      if (s) out.set(d, s);
    }
  });
  await Promise.all(workers);
  return out;
}
