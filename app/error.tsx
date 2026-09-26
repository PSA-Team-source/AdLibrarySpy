'use client';
import { useEffect } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app] unhandled error', error); }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <BrandMark size={32} className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page could not be loaded. The error has been logged.
        </p>
        {error.digest && <code className="mt-3 block font-mono text-xs text-muted-foreground">ref {error.digest}</code>}
        <button type="button" onClick={reset} className="btn-primary mt-6">Try again</button>
      </div>
    </div>
  );
}
