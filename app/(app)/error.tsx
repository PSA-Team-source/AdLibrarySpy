'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Full-height routes (/shops, /ads) render without the shell's padding wrapper.
const FULL_HEIGHT = new Set(['/shops', '/ads']);

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app] page error', error); }, [error]);
  const fullHeight = FULL_HEIGHT.has(usePathname());
  return (
    <div className={cn('flex flex-col gap-6', fullHeight && 'h-full overflow-auto px-4 py-6 lg:px-8')}>
      <div className="card max-w-lg p-6">
        <h1 className="text-2xl font-light tracking-tight text-foreground">This page could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The market index may be temporarily unavailable. Retrying usually works.
        </p>
        {error.digest && <code className="mt-3 block font-mono text-xs text-muted-foreground">ref {error.digest}</code>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/shops" className="btn-ghost">Back to shops</Link>
        </div>
      </div>
    </div>
  );
}
