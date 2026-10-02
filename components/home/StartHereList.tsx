'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { compact } from '@/lib/format';
import type { StarterShop } from '@/lib/start-here';
import { ShopLogo } from '@/components/ShopMedia';
import TrackButton from '@/components/TrackButton';
import { starterShops } from '@/app/(app)/shops/starters';
import { hideShopAction } from '@/app/(app)/shops/actions';

type Niche = { id: string; name: string };
const SHOWN = 3;

/** Three stores at a time; X hides one for good and the next slides in. Chips switch category. */
export function StartHereList({ initial, initialNiche, favourite, niches }: {
  initial: StarterShop[]; initialNiche: string | null; favourite: Niche | null; niches: Niche[];
}) {
  const [queue, setQueue] = useState(initial);
  const [niche, setNiche] = useState(initialNiche);
  const [pending, start] = useTransition();

  const chips: { id: string | null; label: string }[] = [
    ...(favourite ? [{ id: favourite.id, label: `For you: ${favourite.name}` }] : []),
    { id: null, label: 'All' },
    ...niches.map(n => ({ id: n.id, label: n.name })),
  ];

  function pick(id: string | null) {
    if (id === niche) return;
    setNiche(id);
    start(async () => setQueue(await starterShops(id).catch(() => [])));
  }

  function dismiss(s: StarterShop) {
    setQueue(q => q.filter(x => x.id !== s.id));
    void hideShopAction({ id: s.id, domain: s.domain, name: s.name }).catch(() => {});
  }

  const shown = queue.slice(0, SHOWN);
  return (
    <section aria-labelledby="start-here" className="w-full">
      <h3 id="start-here" className="text-base font-semibold text-foreground">{favourite ? 'Picked for you' : 'Start here'}</h3>
      <div>
      <p className="mt-1 text-sm text-muted-foreground">
        Stores adding the most Facebook and Instagram ads right now. Open one, track it, or tap × to see the next.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Category">
        {chips.map(c => (
          <button key={c.id ?? 'all'} type="button" role="tab" aria-selected={niche === c.id} onClick={() => pick(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${niche === c.id ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-muted'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <ul className={`mt-2 divide-y divide-border ${pending ? 'opacity-50' : ''}`} aria-busy={pending}>
        {shown.map(s => (
          <li key={s.id} className="flex min-w-0 items-center gap-3 py-2.5">
            <Link href={`/shops/${encodeURIComponent(s.id)}`} className="flex min-w-0 flex-1 items-center gap-3">
              <ShopLogo src={s.logo} name={s.name || s.domain} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{s.name || s.domain}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[
                    `${compact(s.metaAds)} ads running`,
                    s.monthlyVisits > 0 ? `${compact(s.monthlyVisits)} visits a month${s.trafficSource === 'index' ? ' (estimate)' : ''}` : '',
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <TrackButton shop={{ id: s.id, domain: s.domain, name: s.name }} initial={false} />
              <button type="button" onClick={() => dismiss(s)} aria-label={`Not interested in ${s.name || s.domain}, show the next store`}
                title="Not interested" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!pending && !shown.length && (
        <p className="py-3 text-sm text-muted-foreground">
          You have seen every store here. Pick another category above, or <Link href="/shops?sortBy=num_ads_increase" className="font-medium text-foreground underline">browse all shops</Link>.
        </p>
      )}
      </div>
    </section>
  );
}

/**
 * The picks behind a bell in the Shops header, so they cost no page height.
 * The dot shows until the panel is first opened on this browser (best-effort storage).
 */
export function PicksBell(props: Parameters<typeof StartHereList>[0]) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setSeen(localStorage.getItem('picks-seen') === '1'); } catch {} }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  function toggle() {
    setOpen(o => !o);
    if (!seen) { setSeen(true); try { localStorage.setItem('picks-seen', '1'); } catch {} }
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        aria-label={props.favourite ? 'Picked for you' : 'Start here'} title={props.favourite ? 'Picked for you' : 'Start here'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--a-fill)] text-foreground transition-colors hover:bg-[var(--a-fill-hover)]">
        <Bell className="h-4 w-4" aria-hidden />
        {!seen && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--a-red)]" />}
      </button>
      {/* Kept mounted once opened so dismissed stores and the chosen category survive a close. */}
      <div role="dialog" aria-label="Picked for you" hidden={!open}
        className="absolute right-0 top-11 z-40 w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-card p-4 shadow-xl">
        <StartHereList {...props} />
      </div>
    </div>
  );
}
