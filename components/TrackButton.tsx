'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function TrackButton({ shop, initial }: {
  shop: { id: string; domain: string; name: string };
  initial: boolean;
}) {
  const [tracked, setTracked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch('/api/trackers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, action: tracked ? 'remove' : 'add' }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not update tracking');
        setTracked(body.tracked);
        router.refresh();                    // keep the sidebar count in step
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update tracking');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={toggle} disabled={pending} aria-pressed={tracked} className={tracked ? 'btn-primary' : 'btn-ghost'}>
        {pending ? 'Saving…' : tracked ? '✓ Tracking' : '＋ Track brand'}
      </button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
