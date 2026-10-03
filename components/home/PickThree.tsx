'use client';
// "Pick 3 shops to watch": first-session step for new users in the test's
// treatment arm (app/(app)/shops/pick-three-load.ts). Real ranked stores from the
// "Start here" data; one tap tracks; skip any time; done links to the Brandtracker.
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus, X } from 'lucide-react';
import { compact } from '@/lib/format';
import type { StarterShop } from '@/lib/start-here';
import { ShopLogo } from '@/components/ShopMedia';
import { starterShops } from '@/app/(app)/shops/starters';
import { pickThreeSkip, pickThreeTracked } from '@/app/(app)/shops/pick-three';

type Niche = { id: string; name: string };
const GOAL = 3;

export function PickThree({ initial, initialNiche, favourite, niches }: {
  initial: StarterShop[]; initialNiche: string | null; favourite: Niche | null; niches: Niche[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [shops, setShops] = useState(initial);
  const [niche, setNiche] = useState(initialNiche);
  const [tracked, setTracked] = useState<StarterShop[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, start] = useTransition();

  const chips: { id: string | null; label: string }[] = [
    ...(favourite ? [{ id: favourite.id, label: favourite.name }] : []),
    { id: null, label: 'All' },
    ...niches.map(n => ({ id: n.id, label: n.name })),
  ];

  function close(skip: boolean) {
    setOpen(false);
    if (skip) void pickThreeSkip().catch(() => {});
    router.refresh(); // sidebar tracker count
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(!done); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function pick(id: string | null) {
    if (id === niche) return;
    setNiche(id);
    // Keep stores already tracked here on screen so they can still be undone.
    start(async () => {
      const next = await starterShops(id).catch(() => []);
      setShops([...tracked, ...next.filter(s => !tracked.some(t => t.id === s.id))]);
    });
  }

  async function toggle(s: StarterShop) {
    const on = tracked.some(t => t.id === s.id);
    setBusy(s.id); setError(null);
    try {
      const res = await fetch('/api/trackers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: on ? 'remove' : 'add', shop: { id: s.id, domain: s.domain, name: s.name } }),
      });
      if (!res.ok) throw new Error();
      setTracked(t => on ? t.filter(x => x.id !== s.id) : [...t, s]);
      const r = await pickThreeTracked();
      if (r.done) setDone(true);
    } catch {
      setError('Could not save that. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;
  const n = Math.min(tracked.length, GOAL);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={e => { if (e.target === e.currentTarget) close(!done); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pick3-title"
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:max-w-lg sm:rounded-2xl">
        {done ? (
          <div className="p-5 sm:p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--a-fill)]"><Check className="h-6 w-6 text-foreground" aria-hidden /></div>
            <h2 id="pick3-title" className="mt-3 text-center text-lg font-semibold text-foreground">You are watching {tracked.length} shops</h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              We will email you when they change: new ads, more visitors, new products or price moves.
            </p>
            <ul className="mt-4 space-y-2">
              {tracked.map(s => (
                <li key={s.id} className="flex min-w-0 items-center gap-3">
                  <ShopLogo src={s.logo} name={s.name || s.domain} size={28} />
                  <span className="truncate text-sm font-medium text-foreground">{s.name || s.domain}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Link href="/brandtracker" onClick={() => setOpen(false)} className="btn-primary justify-center sm:flex-1">See my shops</Link>
              <button type="button" onClick={() => close(false)} className="btn-ghost justify-center sm:flex-1">Keep browsing</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
              <div className="min-w-0 flex-1">
                <h2 id="pick3-title" className="text-lg font-semibold text-foreground">Pick 3 shops to watch</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">We will email you when they launch new ads or grow. Choose a category, then tap Track.</p>
              </div>
              <button type="button" onClick={() => close(true)} aria-label="Skip for now"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="px-4 sm:px-5">
              <div className="flex items-center gap-3" aria-live="polite">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(n / GOAL) * 100}%` }} />
                </div>
                <span className="shrink-0 text-xs font-medium text-foreground">{n} of {GOAL}</span>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Category">
                {chips.map(c => (
                  <button key={c.id ?? 'all'} type="button" role="tab" aria-selected={niche === c.id} onClick={() => pick(c.id)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${niche === c.id ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-muted'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className={`min-h-0 flex-1 divide-y divide-border overflow-y-auto px-4 sm:px-5 ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
              {shops.map(s => {
                const on = tracked.some(t => t.id === s.id);
                return (
                  <li key={s.id} className="flex min-w-0 items-center gap-3 py-2.5">
                    <ShopLogo src={s.logo} name={s.name || s.domain} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.name || s.domain}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[`${compact(s.metaAds)} ads running`, s.monthlyVisits > 0 ? `${compact(s.monthlyVisits)} visits a month` : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <button type="button" onClick={() => toggle(s)} disabled={busy != null} aria-pressed={on}
                      aria-label={on ? `Stop tracking ${s.name || s.domain}` : `Track ${s.name || s.domain}`}
                      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium ${on ? 'bg-foreground text-background' : 'border border-border text-foreground hover:bg-muted'}`}>
                      {on ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                      {busy === s.id ? 'Saving…' : on ? 'Tracking' : 'Track'}
                    </button>
                  </li>
                );
              })}
              {!loading && !shops.length && (
                <li className="py-4 text-sm text-muted-foreground">No live stores in this category right now. Pick another one above.</li>
              )}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-border p-4 sm:px-5">
              {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : <span />}
              <button type="button" onClick={() => close(true)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Skip for now</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
