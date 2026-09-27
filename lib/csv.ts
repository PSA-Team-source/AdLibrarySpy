// RFC 4180 CSV for every download the app serves (Shops, Ads, the audit trail).
// Pure and dependency-free so tests/csv.test.mjs can import it directly.

/** Byte-order mark: tells Excel the file is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Spreadsheet formula triggers (OWASP "CSV injection"): =, +, -, @, tab, CR. */
const FORMULA = /^[=+\-@\t\r]/;

/**
 * One CSV field. Text that a spreadsheet would evaluate as a formula is
 * prefixed with `'` so an ad's copy or a shop's title can never run in the
 * reader's Excel; numbers are written as numbers (a negative growth rate is
 * data, not a formula). Quoted only when it must be.
 */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'boolean') s = v ? 'true' : 'false';
  else if (v instanceof Date) s = Number.isNaN(v.getTime()) ? '' : v.toISOString();
  else {
    s = String(v);
    if (FORMULA.test(s)) s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A whole CSV document: UTF-8 BOM (so Excel reads accents and emoji instead of
 * mojibake), a header line, CRLF line endings as RFC 4180 specifies.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  return BOM + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** `adlibraryspy-<kind>-YYYY-MM-DD.csv`, UTC — the client names its download the same way. */
export function csvFileName(kind: string, now = new Date()): string {
  return `adlibraryspy-${kind}-${now.toISOString().slice(0, 10)}.csv`;
}

/** Rows in one Shops / Ads export (the fair-use export bucket counts downloads). */
export const EXPORT_MAX_ROWS = 1000;

/** An attachment response for a CSV document. */
export function csvResponse(csv: string, fileName: string, headers: Record<string, string> = {}): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      ...headers,
    },
  });
}

export interface ExportPage<T> { items: T[]; total: number | null; hasMore: boolean }

/**
 * Up to `maxRows` rows of a paged list, in order, de-duplicated by id (the
 * index can repeat a row across pages when sort values tie). With a known
 * total the remaining pages load `concurrency` at a time; without one they
 * load one after another until a page says there is no more.
 */
export async function collectPages<T extends { id: string }>(
  load: (page: number) => Promise<ExportPage<T>>,
  { pageSize, maxRows, concurrency = 1 }: { pageSize: number; maxRows: number; concurrency?: number },
): Promise<T[]> {
  const first = await load(1);
  const pages: T[][] = [first.items];
  const cap = Math.ceil(maxRows / pageSize);
  const last = first.total != null ? Math.min(cap, Math.ceil(first.total / pageSize)) : cap;
  let more = first.hasMore && first.items.length > 0;
  for (let p = 2; more && p <= last; p += concurrency) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(concurrency, last - p + 1) }, (_, i) => load(p + i)),
    );
    for (const r of batch) {
      pages.push(r.items);
      if (!r.hasMore || r.items.length === 0) { more = false; break; }
    }
  }
  const seen = new Set<string>();
  return pages.flat().filter(r => !seen.has(r.id) && seen.add(r.id)).slice(0, maxRows);
}
