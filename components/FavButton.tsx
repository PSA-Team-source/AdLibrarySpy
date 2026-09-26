'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { patchCachedShop } from '@/components/market/shops-cache';
import { afterSaveAction } from '@/components/growth/actions';
import InviteNudge, { claimInviteNudge } from '@/components/growth/InviteNudge';

export default function FavButton({ type, id, initial, label }: {
  type: 'shop' | 'ad'; id: string; initial?: boolean; label?: boolean;
}) {
  const [saved, setSaved] = useState(!!initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [nudge, setNudge] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    const next = !saved;
    setSaved(next);                                    // optimistic
    start(async () => {
      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save');
        const body = await res.json();
        setSaved(body.saved);
        if (type === 'shop') patchCachedShop(qc, id, { saved: body.saved });
        router.refresh();                              // purge cached /favorites screens
        // First-save funnel stamp + team-invite prompt; never affects the save.
        if (body.saved) afterSaveAction().then(r => { if (r.nudge && claimInviteNudge()) setNudge(true); }, () => {});
      } catch (err) {
        setSaved(!next);                               // roll back
        setError(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  return (
    <>
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      title={error ?? (saved ? 'Saved — click to remove' : 'Save')}
      className={label
        ? (saved ? 'btn-primary' : 'btn-ghost')
        : `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-colors hover:bg-muted disabled:opacity-50 ${error ? 'text-destructive' : saved ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground hover:text-amber-500 dark:hover:text-amber-400'}`}
    >
      {label ? (saved ? '★ Saved' : '☆ Save') : (saved ? '★' : '☆')}
    </button>
    {nudge && <InviteNudge onClose={() => setNudge(false)} />}
    </>
  );
}
