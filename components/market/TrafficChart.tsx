// Traffic sparkline, drawn the same way as the PlatformDTC market pages so both
// surfaces show the same curve. Takes AdLibrarySpy's Point[] shape.
import type { Point } from '@/lib/types';

export function trafficChartColor(growthRate: number | null): string {
  // A flat series is neutral, not "bad". This must be a literal mid-grey rather
  // than a token: the design system forces --muted-foreground to pure black in
  // light mode and pure white in dark, so either would draw a hard, alarming
  // line. gray-400 sits legibly on both grounds.
  if (growthRate == null || growthRate === 0) return '#9ca3af';
  if (growthRate > 0) return '#10b981';
  return '#ef4444';
}

function domainOf(points: Point[]) {
  const values = points.map(p => p.v);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  return { maxValue, minValue, range: maxValue - minValue || 1 };
}

/** Smoothed cubic path through the points (v3's getTrafficLinePath). */
function linePath(
  points: Point[],
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  plotLeft: number,
  plotRight: number,
): string {
  if (points.length === 1) {
    const y = yFor(points[0].v);
    return `M${plotLeft.toFixed(1)},${y.toFixed(1)} L${plotRight.toFixed(1)},${y.toFixed(1)}`;
  }
  return points.reduce((path, point, index) => {
    const x = xFor(index);
    const y = yFor(point.v);
    if (index === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const px = xFor(index - 1);
    const py = yFor(points[index - 1].v);
    const c1 = px + (x - px) * 0.5;
    const c2 = x - (x - px) * 0.5;
    return `${path} C${c1.toFixed(1)},${py.toFixed(1)} ${c2.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, '');
}

/**
 * Inline 64x24 sparkline for a table row, drawn exactly as PlatformDTC's
 * top-brands table does: a 2px trend-coloured line at 60% opacity inside a
 * `h-8 w-16 rounded bg-foreground/5` well. Renders nothing — not even the well —
 * without real points.
 */
export function TrafficSparkline({ data, growthRate }: { data: Point[]; growthRate: number | null }) {
  const points = data.filter(p => p.v > 0);
  if (points.length === 0) return null;

  const width = 64, height = 24, padding = 2;
  const chartWidth = 60, chartHeight = 20;
  const { minValue, range } = domainOf(points);
  const xFor = (i: number) => padding + (i / Math.max(1, points.length - 1)) * chartWidth;
  const yFor = (v: number) => chartHeight - padding - ((v - minValue) / range) * (chartHeight - padding * 2);
  const d = linePath(points, xFor, yFor, padding, width - padding);

  return (
    <div className="flex h-8 w-16 shrink-0 items-center justify-center rounded bg-foreground/5">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
        <path d={d} stroke={trafficChartColor(growthRate)} strokeWidth="2" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    </div>
  );
}

/** Full-width chart for the brand detail view, with month labels and a value axis. */
export function TrafficDetailChart({ data, growthRate }: { data: Point[]; growthRate: number | null }) {
  const points = data.filter(p => p.v > 0);
  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No traffic recorded for this store
      </div>
    );
  }

  const width = 600, height = 180;
  const padLeft = 48, padRight = 12, padTop = 12, padBottom = 24;
  const { minValue, maxValue, range } = domainOf(points);
  const xFor = (i: number) => padLeft + (i / Math.max(1, points.length - 1)) * (width - padLeft - padRight);
  const yFor = (v: number) => height - padBottom - ((v - minValue) / range) * (height - padTop - padBottom);
  const color = trafficChartColor(growthRate);
  const fmt = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img"
      aria-label={`Traffic across ${points.length} measured month${points.length > 1 ? 's' : ''}`}>
      {[maxValue, (maxValue + minValue) / 2, minValue].map((v, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={yFor(v)} y2={yFor(v)}
            stroke="hsl(var(--chart-grid))" />
          <text x={padLeft - 8} y={yFor(v) + 4} textAnchor="end"
            className="fill-muted-foreground" style={{ fontSize: 11 }}>{fmt(v)}</text>
        </g>
      ))}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} stroke="hsl(var(--chart-axis))" />
      <line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} stroke="hsl(var(--chart-axis))" />
      <path d={linePath(points, xFor, yFor, padLeft, width - padRight)}
        stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.t} cx={xFor(i)} cy={yFor(p.v)} r="4" fill={color} stroke="hsl(var(--card))" strokeWidth="2" />
      ))}
      {points.map((p, i) => (
        <text key={`${p.t}-label`} x={xFor(i)} y={height - 6} textAnchor="middle"
          className="fill-muted-foreground" style={{ fontSize: 11 }}>{p.t}</text>
      ))}
    </svg>
  );
}
