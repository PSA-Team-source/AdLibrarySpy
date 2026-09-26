'use client';
// Small client islands for the ads library card and detail drawer.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Link2, Check, ChevronLeft, ChevronRight, X, Store, Layers, ExternalLink } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { hasAppHistory } from '@/lib/app-history';

/** Ad copy clamped to two lines, with "See more" only when it actually overflows. */
export function ExpandableCopy({ text, lines = 2, className }: { text: string; lines?: 2 | 3; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  if (!text) return null;
  return (
    <div className={className}>
      <p ref={ref} className={cn('whitespace-pre-line text-xs leading-relaxed text-foreground/90',
        !open && (lines === 2 ? 'line-clamp-2' : 'line-clamp-3'))}>
        {text}
      </p>
      {(overflows || open) && (
        <button type="button" onClick={() => setOpen(o => !o)}
          className="mt-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          {open ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  );
}

function useCopied(): [boolean, (value: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return [copied, (value: string) => {
    navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {});
  }];
}

const absolute = (path: string) => (typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString());

/** Per-card ⋯ menu: only actions that lead somewhere real. */
export function AdMenu({ adId, shopId, domain, libraryUrl }: {
  adId: string; shopId: string; domain: string; libraryUrl: string;
}) {
  const [copied, copy] = useCopied();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Ad actions"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={e => { e.preventDefault(); copy(absolute(`/ads/${adId}`)); }}>
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? 'Link copied' : 'Copy link'}
        </DropdownMenuItem>
        {shopId && (
          <DropdownMenuItem asChild>
            <Link href={`/shops/${shopId}`}><Store className="h-4 w-4" /> Shop analytics</Link>
          </DropdownMenuItem>
        )}
        {domain && (
          <DropdownMenuItem asChild>
            <Link href={`/ads?store=${encodeURIComponent(domain)}`}><Layers className="h-4 w-4" /> All ads from this shop</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={libraryUrl} target="_blank" rel="noopener noreferrer nofollow">
            <ExternalLink className="h-4 w-4" /> Open in Meta Ad Library
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- grid order, so the drawer can step through the page ----------

const AdsNavContext = createContext<{ ids: string[]; setIds: (ids: string[]) => void } | null>(null);

export function AdsNavProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  return <AdsNavContext.Provider value={{ ids, setIds }}>{children}</AdsNavContext.Provider>;
}

/** Rendered by the grid: publishes the visible order. */
export function AdsNavRegister({ ids }: { ids: string[] }) {
  const ctx = useContext(AdsNavContext);
  const key = ids.join(',');
  useEffect(() => {
    ctx?.setIds(key ? key.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/**
 * Drawer header: position within the grid page with prev/next, and close.
 * Position renders only when the ad is on the grid the drawer was opened from.
 */
export function AdDrawerNav({ id, drawer }: { id: string; drawer: boolean }) {
  const ctx = useContext(AdsNavContext);
  const router = useRouter();
  const ids = drawer ? ctx?.ids ?? [] : [];
  const i = ids.indexOf(id);
  const prev = i > 0 ? ids[i - 1] : null;
  const next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') router.back();
      if (e.key === 'ArrowLeft' && prev) router.replace(`/ads/${prev}`, { scroll: false });
      if (e.key === 'ArrowRight' && next) router.replace(`/ads/${next}`, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, prev, next, router]);

  const btn = 'grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground';
  return (
    <div className="flex items-center gap-2">
      {i >= 0 && (
        <>
          {prev
            ? <Link replace scroll={false} href={`/ads/${prev}`} aria-label="Previous ad" className={btn}><ChevronLeft className="h-4 w-4" /></Link>
            : <span className={cn(btn, 'pointer-events-none opacity-40')} aria-hidden><ChevronLeft className="h-4 w-4" /></span>}
          <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums text-muted-foreground">{i + 1}/{ids.length}</span>
          {next
            ? <Link replace scroll={false} href={`/ads/${next}`} aria-label="Next ad" className={btn}><ChevronRight className="h-4 w-4" /></Link>
            : <span className={cn(btn, 'pointer-events-none opacity-40')} aria-hidden><ChevronRight className="h-4 w-4" /></span>}
        </>
      )}
      {drawer
        ? <button type="button" onClick={() => router.back()} aria-label="Close" className={btn}><X className="h-4 w-4" /></button>
        // Opened from another screen (a Shops row's ad): close returns there.
        // A shared link or reload has nowhere in-app to go back to: /ads.
        : <Link href="/ads" aria-label="Close" className={btn}
            onClick={e => { if (hasAppHistory()) { e.preventDefault(); router.back(); } }}><X className="h-4 w-4" /></Link>}
    </div>
  );
}

/** Right-hand drawer over the grid. Clicking the backdrop closes it. */
export function AdDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Ad details">
      <button type="button" aria-label="Close ad details" onClick={() => router.back()}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-[920px] flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/** Tabs for the detail panel. Panels are server-rendered and passed in. */
export function DetailTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" className="flex gap-5 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={active === t.key} onClick={() => setActive(t.key)}
            className={cn('-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
              active === t.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key} className="pt-4">{t.content}</div>
      ))}
    </div>
  );
}

/**
 * Boards = the user's favorites folders for ads. A saved ad sits in exactly
 * one (Default Folder when unfiled); clicking another moves it there.
 */
export function AdBoards({ adId, folders, current }: {
  adId: string;
  folders: { id: string; name: string; count: number }[];
  /** undefined = not saved; null = Default Folder; otherwise a folder id. */
  current: string | null | undefined;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setFolder(current); }, [current]);

  if (folder === undefined) {
    return <p className="text-sm text-muted-foreground">Save this ad to file it in one of your boards.</p>;
  }
  async function move(id: string | null) {
    if (busy || id === folder) return;
    setBusy(true); setError('');
    const prev = folder;
    setFolder(id);
    try {
      const res = await fetch('/api/favorites', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ad', id: adId, folderId: id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not move');
      router.refresh();
    } catch (e) {
      setFolder(prev);
      setError(e instanceof Error ? e.message : 'Could not move');
    } finally {
      setBusy(false);
    }
  }
  const rows = [{ id: null as string | null, name: 'Default Folder' }, ...folders.map(f => ({ id: f.id as string | null, name: f.name }))];
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map(r => (
          <li key={r.id ?? 'default'}>
            <button type="button" disabled={busy} onClick={() => move(r.id)} aria-pressed={folder === r.id}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-foreground/[0.03] disabled:opacity-60">
              <span className="text-foreground">{r.name}</span>
              {folder === r.id && <Check className="h-4 w-4 text-foreground" />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Link href="/favorites/ads" className="text-xs font-medium text-muted-foreground hover:text-foreground">Manage boards in Favorites →</Link>
    </div>
  );
}
