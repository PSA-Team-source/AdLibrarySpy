import Link from 'next/link';
import { ArrowDown, Check, ChevronDown, ChevronRight, Clapperboard, Folder, FolderInput, Plus, ScanEye, Search, Store } from 'lucide-react';
import { requireCtx } from '@/lib/auth/guard';
import { getShops, queryShops, trackedShopIds } from '@/lib/data';
import {
  TRACKER_WINDOWS, trackerBoard, trackerFolders,
  type BoardTracker, type TrackerWindow,
} from '@/lib/trackers';
import { compact, timeAgo } from '@/lib/format';
import { trafficCaption } from '@/lib/traffic/similarweb';
import type { Shop } from '@/lib/types';
import { cleanDomain } from '@/lib/market/shops';
import UntrackButton from '@/components/UntrackButton';
import TrackButton from '@/components/TrackButton';
import { ShopLogo } from '@/components/ShopMedia';
import { PageShell } from '@/components/layouts/page-shell';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { createFolderAction, deleteFolderAction, moveTrackerAction } from './actions';

export const metadata = { title: 'Brandtracker' };
export const dynamic = 'force-dynamic';

const SORTS = {
  visits: 'Most monthly visits',
  growth: 'Fastest traffic growth',
  ads: 'Most live ads',
  newAds: 'Most new ads',
  recent: 'Recently added',
} as const;
type SortKey = keyof typeof SORTS;

const VISITS_MIN = [10_000, 100_000, 1_000_000, 10_000_000];
const ADS_MIN = [1, 10, 50, 100, 500];

type Params = {
  q?: string; folder?: string; window?: string; sort?: string;
  visitsMin?: string; trend?: string; adsMin?: string; newAds?: string; folderError?: string;
};

function sortValue(t: BoardTracker, key: SortKey): number {
  switch (key) {
    case 'visits': return t.latest?.monthlyVisits ?? -1;
    case 'growth': return t.delta.visitsPct ?? -Infinity;
    case 'ads': return t.latest?.liveAds ?? -1;
    case 'newAds': return t.delta.newAds ?? -1;
    case 'recent': return t.createdAt.getTime();
  }
}

function Delta({ value, pct, unit = '' }: { value: number | null; pct?: number | null; unit?: string }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  return (
    <div className={`text-xs tabular-nums ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
      {up ? '+' : '−'}{compact(Math.abs(value))}{unit}
      {pct != null && pct !== 0 && <span className="ml-1">({up ? '+' : '−'}{Math.abs(pct)}%)</span>}
    </div>
  );
}

export default async function BrandtrackerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 200);
  const window: TrackerWindow = sp.window && sp.window in TRACKER_WINDOWS ? sp.window as TrackerWindow : '1d';
  const sort: SortKey = sp.sort && sp.sort in SORTS ? sp.sort as SortKey : 'visits';
  const visitsMin = Number(sp.visitsMin) || 0;
  const adsMin = Number(sp.adsMin) || 0;
  const trend = sp.trend === 'up' || sp.trend === 'down' ? sp.trend : '';
  const onlyNewAds = sp.newAds === '1';

  const [board, folders] = await Promise.all([
    trackerBoard(ctx.workspaceId, window),
    trackerFolders(ctx.workspaceId),
  ]);
  const activeFolder = sp.folder === 'none' ? 'none' : folders.find(f => f.id === sp.folder) ? sp.folder! : '';
  const folderName = activeFolder === 'none' ? 'No folder' : folders.find(f => f.id === activeFolder)?.name;

  // Logos come from the index; the board still renders when it is unreachable.
  const shopById = new Map<string, Shop>(
    (await getShops(board.map(t => t.shopId)).catch(() => [] as Shop[])).map(s => [s.id, s]),
  );

  // Header search = add a tracker: matching stores from the index, each
  // trackable. A pasted URL is reduced to its host first.
  const term = /[./]/.test(q) ? cleanDomain(q) || q : q;
  const addResults = term
    ? await queryShops({ q: term, limit: 6 }).then(r => r.items).catch(() => [] as Shop[])
    : [];
  const addTracked = addResults.length ? await trackedShopIds(ctx.workspaceId, addResults.map(s => s.id)) : new Set<string>();

  const needle = term.toLowerCase();
  const visible = board
    .filter(t => !activeFolder || (activeFolder === 'none' ? !t.folderId : t.folderId === activeFolder))
    .filter(t => !needle || `${t.name} ${t.domain}`.toLowerCase().includes(needle))
    .filter(t => !visitsMin || (t.latest?.monthlyVisits ?? 0) >= visitsMin)
    .filter(t => !adsMin || (t.latest?.liveAds ?? 0) >= adsMin)
    .filter(t => !trend || (t.delta.visits !== null && (trend === 'up' ? t.delta.visits > 0 : t.delta.visits < 0)))
    .filter(t => !onlyNewAds || (t.delta.newAds ?? 0) > 0)
    .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));

  const filterCount = [visitsMin, adsMin, trend, onlyNewAds].filter(Boolean).length;
  const href = (patch: Partial<Params>) => {
    const p = new URLSearchParams();
    const merged: Params = { q, folder: activeFolder, window, sort, visitsMin: sp.visitsMin, trend, adsMin: sp.adsMin, newAds: sp.newAds, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && k !== 'folderError') p.set(k, v);
    const s = p.toString();
    return s ? `/brandtracker?${s}` : '/brandtracker';
  };
  const menu = 'absolute z-20 mt-2 min-w-56 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg';
  const menuItem = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-foreground hover:bg-accent';
  const addLabel = 'btn-primary cursor-pointer';

  return (
    <PageShell
      title="Brandtracker"
      actions={(
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <form action="/brandtracker" className="flex w-full min-w-0 sm:w-[420px]">
            {activeFolder && <input type="hidden" name="folder" value={activeFolder} />}
            <div className="flex h-10 w-full items-center gap-2 rounded-md border border-[hsl(var(--input-border))] bg-input pl-3 pr-1 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id="tracker-search" name="q" defaultValue={q} autoComplete="off"
                placeholder="Search for a shop, page or URL" aria-label="Search for a shop, page or URL"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
              />
            </div>
          </form>
          <label htmlFor="tracker-search" className={addLabel}><ScanEye className="h-4 w-4" /> Add a Brandtracker</label>
        </div>
      )}
    >
      {q && (
        <section className="card p-4" aria-label="Add a tracker from the index">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">Stores matching “{q}”</h2>
            <Link href={`/shops?q=${encodeURIComponent(q)}`} className="text-xs text-muted-foreground hover:text-foreground">See all in Shops →</Link>
          </div>
          {addResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No store in the index matches this search.</p>
          ) : (
            <ul className="divide-y divide-border">
              {addResults.map(s => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <ShopLogo src={s.logo} name={s.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/shops/${s.id}`} className="block truncate text-sm font-medium text-foreground hover:underline">{s.name}</Link>
                    <div className="truncate text-xs text-muted-foreground">{s.domain}</div>
                  </div>
                  {s.monthlyVisits > 0 && <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{compact(s.monthlyVisits)} visits/mo</span>}
                  {s.metaAds > 0 && <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{compact(s.metaAds)} live ads</span>}
                  <TrackButton shop={{ id: s.id, domain: s.domain, name: s.name }} initial={addTracked.has(s.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
              <Folder className="h-4 w-4 text-muted-foreground" />
              {folderName ?? 'All / No folder'}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </summary>
            <div className={menu}>
              <Link href={href({ folder: '' })} className={menuItem}>{!activeFolder ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}All trackers</Link>
              <Link href={href({ folder: 'none' })} className={menuItem}>{activeFolder === 'none' ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}No folder</Link>
              {folders.map(f => (
                <div key={f.id} className="flex items-center">
                  <Link href={href({ folder: f.id })} className={menuItem}>
                    {activeFolder === f.id ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{f.trackers}</span>
                  </Link>
                  <form action={deleteFolderAction}>
                    <input type="hidden" name="folderId" value={f.id} />
                    <input type="hidden" name="name" value={f.name} />
                    <button type="submit" className="rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-destructive" aria-label={`Delete folder ${f.name}`}>Delete</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent" aria-label="New folder" title="New folder">
              <Plus className="h-4 w-4" />
            </summary>
            <form action={createFolderAction} className={`${menu} flex items-center gap-2 p-2`}>
              <input name="name" required maxLength={60} placeholder="Folder name" aria-label="Folder name" className="h-9 min-w-0 flex-1 rounded-md border border-[hsl(var(--input-border))] bg-input px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
              <button type="submit" className="btn-primary h-9">Create</button>
            </form>
          </details>
          {sp.folderError && (
            <span role="alert" className="text-xs text-destructive">
              {sp.folderError === 'exists' ? 'A folder with that name already exists.' : 'Folder names are 1–60 characters.'}
            </span>
          )}
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{board.length}</span> tracker{board.length === 1 ? '' : 's'} used
        </span>
      </div>

      <details className="card group" open={filterCount > 0}>
        <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Filter By :</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground"><Store className="h-4 w-4" /> Shop</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground"><Clapperboard className="h-4 w-4" /> Ads</span>
          {filterCount > 0 && <span className="pill">{filterCount} active</span>}
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <form action="/brandtracker" className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          {q && <input type="hidden" name="q" value={q} />}
          {activeFolder && <input type="hidden" name="folder" value={activeFolder} />}
          <input type="hidden" name="window" value={window} />
          <input type="hidden" name="sort" value={sort} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Monthly visits</span>
            <select name="visitsMin" defaultValue={visitsMin || ''} className="h-9 rounded-md border border-[hsl(var(--input-border))] bg-input px-2 text-sm text-foreground">
              <option value="">Any</option>
              {VISITS_MIN.map(v => <option key={v} value={v}>≥ {compact(v)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Traffic over {window}</span>
            <select name="trend" defaultValue={trend} className="h-9 rounded-md border border-[hsl(var(--input-border))] bg-input px-2 text-sm text-foreground">
              <option value="">Any</option>
              <option value="up">Growing</option>
              <option value="down">Declining</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clapperboard className="h-3.5 w-3.5" /> Live ads</span>
            <select name="adsMin" defaultValue={adsMin || ''} className="h-9 rounded-md border border-[hsl(var(--input-border))] bg-input px-2 text-sm text-foreground">
              <option value="">Any</option>
              {ADS_MIN.map(v => <option key={v} value={v}>≥ {compact(v)}</option>)}
            </select>
          </label>
          <div className="flex flex-col justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="newAds" value="1" defaultChecked={onlyNewAds} className="h-4 w-4" />
              New ads in the last {window}
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary h-8 px-3 text-xs">Apply</button>
              {filterCount > 0 && <Link href={href({ visitsMin: '', trend: '', adsMin: '', newAds: '' })} className="btn-ghost h-8 px-3 text-xs">Clear</Link>}
            </div>
          </div>
        </form>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
            <ArrowDown className="h-4 w-4 text-muted-foreground" /> {SORTS[sort]} <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </summary>
          <div className={menu}>
            {(Object.keys(SORTS) as SortKey[]).map(k => (
              <Link key={k} href={href({ sort: k })} className={menuItem}>
                {k === sort ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}{SORTS[k]}
              </Link>
            ))}
          </div>
        </details>
        <nav aria-label="Time window" className="flex rounded-md border border-border bg-card p-0.5">
          {(Object.keys(TRACKER_WINDOWS) as TrackerWindow[]).map(w => (
            <Link key={w} href={href({ window: w })} aria-current={w === window ? 'true' : undefined}
              className={`rounded px-3 py-1 text-sm tabular-nums ${w === window ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {w}
            </Link>
          ))}
        </nav>
      </div>

      <div className="card overflow-hidden">
        <Table className="min-w-[760px]" containerClassName="scroll-thin">
          <TableHeader><TableRow>
            <TableHead>Shop Info</TableHead>
            <TableHead className="text-right">Traffic</TableHead>
            <TableHead className="text-right">Live Ads</TableHead>
            <TableHead className="text-right" title={`Creatives newly indexed in our ad library for the store over the last ${window}`}>New Ads</TableHead>
            <TableHead><span className="sr-only">Manage</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {board.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-20 text-center">
                  <ScanEye className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">No trackers yet</h2>
                  <p className="mx-auto mb-5 mt-1 max-w-md text-sm text-muted-foreground">Start following a shop or a page to get started</p>
                  <div className="flex justify-center gap-2">
                    <label htmlFor="tracker-search" className={addLabel}>Add a Tracker</label>
                    <Link href="/shops" className="btn-ghost">Search a tracker</Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No tracker matches {q ? 'this search' : folderName && !filterCount ? `the folder “${folderName}”` : 'these filters'}.
                </TableCell>
              </TableRow>
            ) : visible.map(t => {
              const shop = shopById.get(t.shopId);
              const caption = t.latest?.monthlyVisits ? trafficCaption(t.latest.monthlyVisitsSource ?? null) : '';
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ShopLogo src={shop?.logo ?? ''} name={t.name || t.domain} size={36} />
                      <div className="min-w-0">
                        <Link href={`/shops/${t.shopId}`} className="block truncate text-sm font-semibold text-foreground hover:underline">{t.name || t.domain}</Link>
                        <a href={`https://${t.domain}`} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-muted-foreground hover:text-foreground">{t.domain} ↗</a>
                        <div className="text-[11px] text-muted-foreground">
                          {t.latestAt ? `Recorded ${timeAgo(t.latestAt)}` : 'Awaiting first recording'}
                          {t.folderId && folders.find(f => f.id === t.folderId) && <> · <Folder className="inline h-3 w-3" /> {folders.find(f => f.id === t.folderId)!.name}</>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.latest && t.latest.monthlyVisits > 0 && (
                      <>
                        <div className="font-medium text-foreground">{compact(t.latest.monthlyVisits)}</div>
                        <Delta value={t.delta.visits} pct={t.delta.visitsPct} />
                        {caption && <div className="text-[10px] text-muted-foreground">{caption}</div>}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.latest && (
                      <>
                        <div className="flex items-center justify-end gap-1.5 font-medium text-foreground">
                          {t.latest.liveAds > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
                          {compact(t.latest.liveAds)}
                        </div>
                        <Delta value={t.delta.liveAds} />
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.delta.newAds !== null && t.delta.newAds > 0 && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">+{compact(t.delta.newAds)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {folders.length > 0 && (
                        <details className="relative">
                          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" title="Move to folder">
                            <FolderInput className="h-4 w-4" /><span className="sr-only">Move to folder</span>
                          </summary>
                          <div className={`${menu} right-0`}>
                            {[{ id: '', name: 'No folder' }, ...folders].map(f => (
                              <form key={f.id || 'none'} action={moveTrackerAction}>
                                <input type="hidden" name="trackerId" value={t.id} />
                                <input type="hidden" name="folderId" value={f.id} />
                                <input type="hidden" name="domain" value={t.domain} />
                                <button type="submit" className={menuItem}>
                                  {(t.folderId ?? '') === f.id ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}{f.name}
                                </button>
                              </form>
                            ))}
                          </div>
                        </details>
                      )}
                      <UntrackButton shop={{ id: t.shopId, domain: t.domain, name: t.name }} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  );
}
