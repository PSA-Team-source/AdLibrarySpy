'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { EXPORT_MAX_ROWS, csvFileName } from '@/lib/csv';

/**
 * "Export CSV" for a list screen: downloads GET /api/export/<kind> with the
 * current query string (filters + sort; the page is dropped, an export starts
 * at row 1). Fetched rather than navigated so a refusal (fair-use limit,
 * signed out) shows here instead of downloading an error body. The file is
 * named on the client — see [[dashboard-csv-downloads-cannot-read-their-own-filename]].
 */
export function ExportCsv({ kind, className }: { kind: 'shops' | 'ads'; className?: string }) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const qs = new URLSearchParams(params);
      qs.delete('page');
      const res = await fetch(`/api/export/${kind}?${qs}`);
      if (res.status === 401) { window.location.assign('/login'); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'The export failed — try again.');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: csvFileName(kind) });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={run} disabled={busy} aria-busy={busy}
        title={`Download these ${kind} as CSV (up to ${EXPORT_MAX_ROWS.toLocaleString('en-US')} rows)`}
        className={className}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        {busy ? 'Exporting…' : 'Export CSV'}
      </button>
      {error && <span role="alert" className="shrink-0 text-[13px] text-[var(--a-red)]">{error}</span>}
    </>
  );
}
