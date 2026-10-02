import Link from 'next/link';
import { ArrowRight, Bot, Folder, ScanEye } from 'lucide-react';
import { requireCtx } from '@/lib/auth/guard';
import { getShops } from '@/lib/data';
import type { Shop } from '@/lib/types';
import { trackerBoard, trackerFolders } from '@/lib/trackers';
import { recentViewCounts, recentViews } from '@/lib/recents';
import { listAudit } from '@/lib/audit';
import { compact } from '@/lib/format';
import { SearchBox } from '@/components/FilterBar';
import { ShopLogo } from '@/components/ShopMedia';
import { PageShell } from '@/components/layouts/page-shell';
import { headers } from 'next/headers';
import { needsStartHere } from '@/lib/start-here';
import { inAppBrowser } from '@/lib/public/in-app-browser';
import { StartHere } from '@/components/home/StartHere';
import { InAppBrowserTip } from '@/components/home/InAppBrowserTip';
import { WeeklyReportPrompt } from '@/components/home/WeeklyReportPrompt';
import { one } from '@/lib/db';
import { RecentRow, VIEW_TABS, parseViewType, shortAgo } from './recent-row';

export const metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ recent?: string; panel?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const recentType = parseViewType(sp.recent);
  const panel = sp.panel === 'activity' ? 'activity' : 'folders';

  const [counts, recents, recentShops, trackers, folders, activity, weeklyChoice] = await Promise.all([
    recentViewCounts(ctx.workspaceId, ctx.user.id).catch(() => ({ shop: 0, ad: 0, advertiser: 0 })),
    recentViews(ctx.workspaceId, ctx.user.id, recentType, 6).catch(() => []),
    recentType === 'shop'
      ? Promise.resolve(null)
      : recentViews(ctx.workspaceId, ctx.user.id, 'shop', 5).catch(() => []),
    trackerBoard(ctx.workspaceId, '7d').catch(() => []),
    panel === 'folders' ? trackerFolders(ctx.workspaceId, 6).catch(() => []) : Promise.resolve([]),
    panel === 'activity' ? listAudit(ctx.workspaceId, { limit: 6 }).then(r => r.items).catch(() => []) : Promise.resolve([]),
    // Any row = they already chose (subscribed or unsubscribed): never ask again.
    one('SELECT 1 FROM newsletter_subscribers WHERE user_id = $1', [ctx.user.id]).catch(() => 'unknown'),
  ]);
  const chips = (recentShops ?? recents).slice(0, 5);
  const topTrackers = [...trackers]
    .sort((a, b) => (b.latest?.monthlyVisits ?? -1) - (a.latest?.monthlyVisits ?? -1))
    .slice(0, 5);
  const trackerShops = new Map<string, Shop>(
    (await getShops(topTrackers.map(t => t.shopId)).catch(() => [] as Shop[])).map(s => [s.id, s]),
  );
  const startHere = needsStartHere(counts, trackers.length);
  const inApp = inAppBrowser((await headers()).get('user-agent'));
  const firstName = ctx.user.name.trim().split(/\s+/)[0] || ctx.user.email.split('@')[0];

  const card = 'flex min-h-[380px] flex-col rounded-xl border border-border bg-card';
  const tab = (active: boolean) => `rounded-md border px-2 py-1 text-xs transition-colors ${active ? 'border-border bg-accent font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
  const underline = (active: boolean) => `-mb-px border-b-2 px-1 pb-2 text-sm transition-colors ${active ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
  const footer = 'flex items-center justify-between border-t border-border px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground';
  const empty = 'flex h-full min-h-44 flex-col items-center justify-center text-center';

  return (
    <PageShell title="Home">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 py-6 sm:py-14">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {startHere ? `Welcome, ${firstName}.` : `Welcome back, ${firstName}.`}
        </h2>
        <div className="flex w-full justify-center">
          <SearchBox destination="/shops" placeholder="Search any shop or brand..." />
        </div>
        {inApp && <InAppBrowserTip app={inApp} />}
        {startHere && <StartHere />}
        {!startHere && !weeklyChoice && <WeeklyReportPrompt />}
        {chips.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Recently viewed shops">
            {chips.map(v => (
              <li key={v.id}>
                <Link href={`/shops/${encodeURIComponent(v.id)}`} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent">
                  <ShopLogo src={v.image} name={v.label} size={16} className="rounded" />
                  <span className="max-w-[160px] truncate">{v.label || v.id}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Recents: what this user opened, newest first. */}
        <section className={card}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h3 className="text-sm font-medium text-foreground">Recents</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{counts[recentType]}</span>
          </div>
          <div className="flex gap-0.5 overflow-x-auto px-5 pb-2">
            {VIEW_TABS.map(t => (
              <Link key={t.type} href={`/home?recent=${t.type}${panel === 'activity' ? '&panel=activity' : ''}`} className={tab(recentType === t.type)} scroll={false}>{t.label}</Link>
            ))}
          </div>
          <div className="min-h-0 flex-1 px-4">
            {recents.length === 0 ? (
              <div className={empty}>
                <p className="text-sm font-medium text-foreground">Nothing viewed yet</p>
                <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                  {VIEW_TABS.find(t => t.type === recentType)!.label} you open will show up here.
                </p>
              </div>
            ) : (
              <ul>{recents.map(v => <RecentRow key={v.id} v={v} />)}</ul>
            )}
          </div>
          <Link href={`/home/history?type=${recentType}`} className={footer}>History <ArrowRight className="h-4 w-4" /></Link>
        </section>

        {/* Recent folders: Brandtracker folders by last update, or workspace activity. */}
        <section className={card}>
          <div className="px-5 pb-2 pt-5">
            <h3 className="text-sm font-medium text-foreground">Recent folders</h3>
          </div>
          <div className="mx-5 flex gap-4 border-b border-border">
            <Link href={`/home?recent=${recentType}`} className={underline(panel === 'folders')} scroll={false}>Folders</Link>
            <Link href={`/home?recent=${recentType}&panel=activity`} className={underline(panel === 'activity')} scroll={false}>Activity</Link>
          </div>
          <div className="min-h-0 flex-1 px-4 pt-1">
            {panel === 'folders' ? (
              folders.length === 0 ? (
                <div className={empty}>
                  <p className="text-sm font-medium text-foreground">No recent folders</p>
                  <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">Your recently updated folders will show up here.</p>
                </div>
              ) : (
                <ul>
                  {folders.map(f => (
                    <li key={f.id}>
                      <Link href={`/brandtracker?folder=${f.id}`} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent">
                        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{f.name}</span>
                          <span className="block text-xs text-muted-foreground">{f.trackers} tracker{f.trackers === 1 ? '' : 's'}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{shortAgo(f.updatedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : activity.length === 0 ? (
              <div className={empty}>
                <p className="text-sm font-medium text-foreground">No recent activity</p>
                <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">What your workspace does will show up here.</p>
              </div>
            ) : (
              <ul>
                {activity.map(item => (
                  <li key={item.id} className="px-1 py-2">
                    <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                    <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.target || item.actorName || item.actorEmail}</span>
                      <span className="shrink-0">{shortAgo(item.createdAt)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href={panel === 'activity' ? '/settings/activity' : '/brandtracker'} className={footer}>History <ArrowRight className="h-4 w-4" /></Link>
        </section>

        {/* Brandtrackers: tracked shops with their latest recorded figures. */}
        <section className={card}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h3 className="text-sm font-medium text-foreground">Brandtrackers</h3>
            {trackers.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{trackers.length}</span>}
          </div>
          <div className="min-h-0 flex-1 px-4">
            {trackers.length === 0 ? (
              <div className={empty}>
                <ScanEye className="mb-3 h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-foreground">Create your first brandtracker</p>
                <Link href="/brandtracker" className="btn-ghost mt-3">Create</Link>
              </div>
            ) : (
              <ul>
                {topTrackers.map(t => {
                  const shop = trackerShops.get(t.shopId);
                  return (
                    <li key={t.id}>
                      <Link href={`/shops/${t.shopId}`} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent">
                        <ShopLogo src={shop?.logo ?? ''} name={t.name || t.domain} size={24} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{t.name || t.domain}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.latest
                              ? [
                                  t.latest.monthlyVisits > 0 ? `${compact(t.latest.monthlyVisits)} visitors` : '',
                                  `${compact(t.latest.liveAds)} active ads`,
                                ].filter(Boolean).join(' · ')
                              : 'Awaiting first recording'}
                          </span>
                        </span>
                        {t.delta.visitsPct !== null && t.delta.visitsPct !== 0 && (
                          <span className={`text-xs tabular-nums ${t.delta.visitsPct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} title="Traffic change over 7 days">
                            {t.delta.visitsPct > 0 ? '+' : ''}{t.delta.visitsPct}%
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link href="/brandtracker" className={footer}>Open Brandtracker <ArrowRight className="h-4 w-4" /></Link>
        </section>

        {/* Our counterpart to the reference's browser-extension card: the MCP connector we actually ship. */}
        <section className={`${card} justify-between p-5`}>
          <div>
            <span className="inline-flex rounded-xl bg-accent p-3 text-foreground"><Bot className="h-5 w-5" /></span>
            <h3 className="mt-4 text-sm font-medium text-foreground">Connect your AI assistant</h3>
            <p className="mt-1 text-sm text-muted-foreground">Search shops, ads, advertisers and your tracked brands from Claude, ChatGPT or any MCP client.</p>
          </div>
          <Link href="/connect" className="btn-primary mt-5 justify-center">Connect <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </PageShell>
  );
}
