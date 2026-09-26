export function compact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

export function money(n: number, ccy = 'USD'): string {
  const sym: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', SEK: 'kr', BRL: 'R$', MXN: 'MX$', JPY: '¥', INR: '₹' };
  return (sym[ccy] ?? '$') + (n >= 1000 ? compact(n) : n.toFixed(2).replace(/\.00$/, ''));
}

export function pct(n: number): string { return (n >= 0 ? '+' : '') + n + '%'; }

/** Age of an ISO date relative to now. Empty input renders nothing. */
export function ageOf(iso: string): string {
  if (!iso) return '';
  const from = new Date(iso);
  if (Number.isNaN(from.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (months < 1) return 'new';
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} month${m > 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y > 1 ? 's' : ''}`;
  return `${y}y ${m}m`;
}

export function dateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthYear(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(t.getTime())) return '';
  const m = Math.floor((Date.now() - t.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : dateShort(t.toISOString());
}

export function flag(code: string): string {
  if (!code || code.length !== 2 || !/^[a-z]{2}$/i.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
}

