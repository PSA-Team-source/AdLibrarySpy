import type { Point, CountryShare } from '@/lib/types';
import { compact, flag } from '@/lib/format';

/**
 * A line needs at least two measured points to mean anything. With fewer, these
 * components render nothing at all rather than a flat or single-point chart.
 */
const MIN_POINTS = 2;

export function Sparkline({ data, w = 120, h = 34, color = '#16a34a' }: {
  data: Point[]; w?: number; h?: number; color?: string;
}) {
  if (!data || data.length < MIN_POINTS) return null;
  const vals = data.map(d => d.v);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const dx = w / (data.length - 1);
  const pts = data.map((d, i) => `${(i * dx).toFixed(1)},${(h - ((d.v - min) / ((max - min) || 1)) * (h - 4) - 2).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Trend, latest ${compact(vals[vals.length - 1])}`}>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}

export function AreaChart({ data, h = 180, color = '#16a34a' }: { data: Point[]; h?: number; color?: string }) {
  if (!data || data.length < MIN_POINTS) return null;
  // Each chart needs its own gradient id: a shared one made every chart on the
  // page adopt the first one's fill. Derived from the data so it stays stable
  // between server render and hydration (a hook would force 'use client').
  const gradientId = `ac${color.replace('#', '')}${data.length}${Math.round(data[0].v)}${Math.round(data[data.length - 1].v)}`;

  const w = 640;
  const vals = data.map(d => d.v);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const dx = w / (data.length - 1);
  const y = (v: number) => h - ((v - min) / ((max - min) || 1)) * (h - 24) - 8;
  const line = 'M' + data.map((d, i) => `${(i * dx).toFixed(1)},${y(d.v).toFixed(1)}`).join(' L');
  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }} role="img"
        aria-label={`${data.length} measured points, from ${compact(vals[0])} to ${compact(vals[vals.length - 1])}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Gridlines at max / mid / min, as PlatformDTC's traffic detail chart draws them. */}
        {[max, (max + min) / 2, min].map((v, i) => (
          <line key={i} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="hsl(var(--chart-grid))"
            vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        {data.filter((_, i) => i % step === 0).map(d => <span key={d.t}>{d.t}</span>)}
      </div>
    </div>
  );
}

export function CountryBars({ data }: { data: CountryShare[] }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-2">
      {data.map(c => (
        <div key={c.code} className="flex items-center gap-2 text-sm">
          <span className="w-6" aria-hidden>{flag(c.code)}</span>
          <span className="w-7 text-xs text-muted-foreground">{c.code}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/5">
            <div className="h-full bg-foreground" style={{ width: `${c.pct}%` }} />
          </div>
          <span className="w-10 text-right text-muted-foreground text-xs tabular-nums">{c.pct}%</span>
        </div>
      ))}
    </div>
  );
}

/** Same bar recipe as CountryBars, for any labelled share (0-100). */
export function ShareBars({ data }: { data: { key: string; label: string; pct: number; title?: string }[] }) {
  if (!data?.length) return null;
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.key} className="flex items-center gap-2 text-sm" title={d.title}>
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{d.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/5">
            <div className="h-full bg-foreground" style={{ width: `${d.pct}%` }} />
          </div>
          <span className="w-10 text-right text-muted-foreground text-xs tabular-nums">{d.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function FlagRow({ data, max = 4 }: { data: CountryShare[]; max?: number }) {
  if (!data?.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {data.slice(0, max).map(c => <span key={c.code} title={`${c.code} ${c.pct}%`}>{flag(c.code)}</span>)}
      {data.length > max && <span className="text-[11px] text-muted-foreground ml-0.5">+{data.length - max}</span>}
    </span>
  );
}
