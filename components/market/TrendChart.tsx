'use client';
import { useMemo, useState } from 'react';
import type { Point } from '@/lib/types';
import { compact } from '@/lib/format';

type Range = '3M' | '6M' | 'ALL';
const MONTHS: Record<Exclude<Range, 'ALL'>, number> = { '3M': 3, '6M': 6 };
const H = 220;

/** "2026-08" → "Aug"; "2026-09-16" → "Sep 16". */
function tick(t: string): string {
  const d = new Date(t.length === 7 ? `${t}-01T00:00:00Z` : `${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('en-US', t.length === 7
    ? { month: 'short', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function full(t: string): string {
  const d = new Date(t.length === 7 ? `${t}-01T00:00:00Z` : `${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('en-US', t.length === 7
    ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Months between the first and last point: the span a range button can cut. */
function spanMonths(data: Point[]): number {
  const a = new Date(`${data[0].t.slice(0, 7)}-01`), b = new Date(`${data[data.length - 1].t.slice(0, 7)}-01`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/**
 * One measured series: area + line, point markers, direct labels, and a
 * hover crosshair with the exact value. Range buttons appear only for ranges
 * that actually cut the data (a 3-month history has no 6M view).
 */
export default function TrendChart({ data, valueLabel, color = '#16a34a' }: {
  data: Point[]; valueLabel: string; color?: string;
}) {
  const ranges = useMemo(() => {
    const span = spanMonths(data);
    return (['3M', '6M'] as const).filter(r => span > MONTHS[r]);
  }, [data]);
  const [range, setRange] = useState<Range>('ALL');
  const [hover, setHover] = useState<number | null>(null);

  const shown = useMemo(() => {
    if (range === 'ALL') return data;
    const last = new Date(`${data[data.length - 1].t.slice(0, 7)}-01`);
    last.setMonth(last.getMonth() - MONTHS[range]);
    const cut = last.toISOString().slice(0, 7);
    return data.filter(p => p.t.slice(0, 7) > cut);
  }, [data, range]);

  if (shown.length < 2) return null;
  const ticks = niceTicks(Math.max(...shown.map(p => p.v)));
  const top = ticks[ticks.length - 1] || 1;
  // 4% inset each side so the end markers and their labels clear the axes.
  // Positioned by date, so a day the crawl missed leaves a visible gap.
  const ms = shown.map(p => Date.parse(p.t.length === 7 ? `${p.t}-01T00:00:00Z` : `${p.t}T00:00:00Z`));
  const t0 = ms[0], span = (ms[ms.length - 1] - t0) || 1;
  const x = (i: number) => 4 + ((ms[i] - t0) / span) * 92;
  const y = (v: number) => 100 - (v / top) * 100;
  const line = shown.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  // Label every point on a short series; on a long one only the extremes and the latest.
  const maxI = shown.reduce((m, p, i) => (p.v > shown[m].v ? i : m), 0);
  const labelled = (i: number) => shown.length <= 12 || i === maxI || i === shown.length - 1;
  const tickStep = Math.max(1, Math.ceil(shown.length / 8));

  return (
    <div>
      {ranges.length > 0 && (
        <div className="mb-3 flex justify-end">
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium" role="group" aria-label="Range">
            {[...ranges, 'ALL' as const].map(r => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className={`rounded-md px-3 py-1 ${range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{r}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground" style={{ height: H }}>
          {ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{compact(t)}</span>)}
        </div>
        <div className="relative flex-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {ticks.map(t => <line key={t} x1={0} x2={100} y1={y(t)} y2={y(t)} stroke="hsl(var(--chart-grid))" vectorEffect="non-scaling-stroke" />)}
            <path d={`${line} L${x(shown.length - 1)},100 L${x(0)},100 Z`} fill={color} opacity={0.12} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={100} stroke="currentColor" className="text-muted-foreground" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
          {shown.map((p, i) => (
            <div key={p.t} className="absolute" style={{ left: `${x(i)}%`, top: `${y(p.v)}%` }}>
              <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                style={{ borderColor: color, ...(hover === i ? { background: color } : {}) }} />
              {labelled(i) && <span className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums text-muted-foreground">{compact(p.v)}</span>}
            </div>
          ))}
          {/* Hit bands wider than the markers, one per point. */}
          <div className="absolute inset-0">
            {shown.map((p, i) => (
              <div key={p.t} className="absolute inset-y-0" style={{ left: `${i ? (x(i - 1) + x(i)) / 2 : 0}%`, right: `${100 - (i < shown.length - 1 ? (x(i) + x(i + 1)) / 2 : 100)}%` }} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                aria-label={`${full(p.t)}: ${valueLabel} ${p.v.toLocaleString()}`} />
            ))}
          </div>
          {hover != null && (
            <div className="pointer-events-none absolute z-10 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${x(hover)}%`, top: `${y(shown[hover].v)}%`, transform: `translate(${hover > shown.length / 2 ? '-105%' : '5%'}, -115%)` }}>
              <div className="text-muted-foreground">{full(shown[hover].t)}</div>
              <div className="font-semibold tabular-nums text-foreground">{valueLabel} {shown[hover].v.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
      <div className="relative ml-12 mt-2 h-4 text-[11px] tabular-nums text-muted-foreground">
        {shown.map((p, i) => (i % tickStep ? null : <span key={p.t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>{tick(p.t)}</span>))}
      </div>
    </div>
  );
}
