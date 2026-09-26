'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function UntrackButton({ shop }: { shop: { id: string; domain: string; name: string } }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        await fetch('/api/trackers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, action: 'remove' }),
        });
        router.refresh();
      })}
      className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}
