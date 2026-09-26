// Shared pieces for the 1200x630 share cards (app/(public)/{store,ad}/.../opengraph-image.tsx).
// Satori (next/og) renders flexbox only, fetches nothing it cannot decode, and throws the
// whole card on a bad <img> — so remote images are pre-fetched here and dropped on any doubt.
import type { ReactNode } from 'react';
import { safeFetch } from '@/lib/safe-fetch';

export const OG_SIZE = { width: 1200, height: 630 };
export const INK = '#050807';
export const LIME = '#a7f45a';
export const MUTED = '#9ba39d';
export const LINE = 'rgba(255,255,255,.12)';

/**
 * Edge caches keep a card a day and serve it stale for a week while refreshing. The
 * next/og default is immutable for a year, which would freeze the numbers on it.
 */
export const OG_HEADERS = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };

const IMAGE_TYPES = /^image\/(png|jpe?g|gif)$/i;   // what satori decodes (no webp/avif/ico)
const MAX_BYTES = 3_000_000;

/** Remote image as a data: URL, or '' when it is missing, slow, huge or undecodable. */
export async function imageData(url: string, { timeoutMs = 3000, minPx = 0 } = {}): Promise<string> {
  if (!/^https:\/\//i.test(url)) return '';
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await safeFetch(url, { signal: ac.signal, headers: { 'User-Agent': 'AdLibrarySpy/1.0 (+https://adlibraryspy.com/bot)' }, next: { revalidate: 86400 } } as RequestInit);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !IMAGE_TYPES.test(type)) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return '';
    // PNG width lives in the IHDR chunk; a tiny one is a placeholder glyph, not a brand mark.
    if (minPx && type === 'image/png' && buf.length > 24 && buf.readUInt32BE(16) < minPx) return '';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

const g = globalThis as unknown as { __ALS_OG_FONT?: Promise<ArrayBuffer | null> };

/**
 * Inter SemiBold for headings. next/og only bundles Noto Sans Regular, and satori cannot
 * synthesise bold. Google Fonts serves TTF to a non-browser client; on failure the card
 * renders in the bundled font rather than failing (and the next request retries).
 */
export function headingFont(): Promise<ArrayBuffer | null> {
  g.__ALS_OG_FONT ??= (async () => {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@600', { next: { revalidate: 604800 } } as RequestInit).then(r => (r.ok ? r.text() : ''));
    const src = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { next: { revalidate: 604800 } } as RequestInit);
    return res.ok ? res.arrayBuffer() : null;
  })().catch(() => null).then(f => { if (!f) g.__ALS_OG_FONT = undefined; return f; });
  return g.__ALS_OG_FONT;
}

export async function ogFonts() {
  const data = await headingFont();
  return data ? [{ name: 'Inter', data, weight: 600 as const, style: 'normal' as const }] : undefined;
}

/** The AdLibrarySpy lockup (same mark as components/brand/brand-mark.tsx: lime square + target). */
export function OgLockup({ size = 40 }: { size?: number }) {
  const s = Math.round(size * 0.63);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#071004" strokeWidth={2.25} strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </svg>
      </div>
      <div style={{ display: 'flex', fontSize: Math.round(size * 0.7), fontWeight: 600, color: '#fff', letterSpacing: -0.5 }}>AdLibrarySpy</div>
    </div>
  );
}

/** A labelled figure. Callers only render it when the figure exists. */
export function OgStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 24px', border: `1px solid ${LINE}`, borderRadius: 18, background: 'rgba(255,255,255,.04)', minWidth: 200 }}>
      <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>{label}</div>
      <div style={{ display: 'flex', fontSize: 46, fontWeight: 600, color: '#fff', marginTop: 4 }}>{value}</div>
      {note && <div style={{ display: 'flex', fontSize: 18, color: MUTED, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: INK, color: '#f7f9f7', padding: 56, fontFamily: 'Inter, "Noto Sans"' }}>
      {children}
    </div>
  );
}

export const clipText = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
