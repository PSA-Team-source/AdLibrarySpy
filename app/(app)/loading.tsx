'use client';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Mirrors PageShell's rhythm (title bar, then cards) so the swap to the real
// page does not shift. Normal routes are padded by the app shell; the
// full-height routes (/shops, /ads) get no wrapper, so pad like
// `PageShell fullHeight` there.
const FULL_HEIGHT = new Set(['/shops', '/ads', '/products']);

export default function Loading() {
  const fullHeight = FULL_HEIGHT.has(usePathname());
  return (
    <div
      className={cn('flex animate-pulse flex-col gap-6', fullHeight && 'h-full px-4 py-6 lg:px-8')}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-10 w-48 shrink-0 rounded-lg bg-muted" />
      <div className="h-24 shrink-0 rounded-xl bg-muted" />
      <div className={cn('rounded-xl bg-muted', fullHeight ? 'min-h-0 flex-1' : 'h-96')} />
    </div>
  );
}
