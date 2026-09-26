import Link from 'next/link';
import { requireCtx } from '@/lib/auth/guard';
import { recentViewCounts, recentViews } from '@/lib/recents';
import { PageShell } from '@/components/layouts/page-shell';
import { RecentRow, VIEW_TABS, parseViewType } from '../recent-row';

export const metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireCtx();
  const type = parseViewType((await searchParams).type);
  const [counts, rows] = await Promise.all([
    recentViewCounts(ctx.workspaceId, ctx.user.id),
    recentViews(ctx.workspaceId, ctx.user.id, type, 200),
  ]);
  const label = VIEW_TABS.find(t => t.type === type)!.label;

  return (
    <PageShell variant="detail" backUrl="/home" title="History" description="Everything you opened, most recent first.">
      <nav className="flex flex-wrap gap-1" aria-label="History type">
        {VIEW_TABS.map(t => (
          <Link key={t.type} href={`/home/history?type=${t.type}`} aria-current={t.type === type ? 'page' : undefined}
            className={`chip ${t.type === type ? 'chip-active' : ''}`}>
            {t.label} <span className="tabular-nums opacity-70">{counts[t.type]}</span>
          </Link>
        ))}
      </nav>
      <div className="card p-3">
        {rows.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">{label} you open will show up here.</p>
        ) : (
          <ul className="divide-y divide-border">{rows.map(v => <RecentRow key={v.id} v={v} showCount />)}</ul>
        )}
      </div>
    </PageShell>
  );
}
