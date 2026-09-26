import Link from 'next/link';
import { requireCtx, hasRole } from '@/lib/auth/guard';
import { listAudit, actionCategories } from '@/lib/audit';
import { timeAgo, dateShort } from '@/lib/format';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export const metadata = { title: 'Activity log' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const num = (v: string | undefined) => (v && Number.isFinite(+v) ? +v : undefined);

function MetaCell({ meta, target, action }: { meta: Record<string, unknown>; target: string | null; action: string }) {
  // Present the most useful piece of context inline. For role/billing-tracked
  // events the target already carries the name; the remaining meta is hidden
  // behind the title so the row stays scannable.
  if (target) {
    return <span className="truncate text-muted-foreground" title={target}>{target}</span>;
  }
  const extra = Object.entries(meta).filter(([k]) => !['interface'].includes(k));
  if (extra.length === 0) return null;
  const text = extra.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
  return <span className="truncate text-muted-foreground" title={text}>{action === 'billing.checkout_started' ? `billing · ${extra[0][1]}` : text}</span>;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const canExport = hasRole(ctx, 'admin');

  const category = sp.category && actionCategories().some(c => c.value === sp.category) ? sp.category : undefined;
  const q = (sp.q ?? '').trim() || undefined;
  const page = Math.max(1, num(sp.page) ?? 1);

  const { items, total } = await listAudit(ctx.workspaceId, { page, limit: PAGE_SIZE, category, q });
  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Activity log"
        description="Every meaningful action in this workspace, recorded as an append-only trail. It cannot be edited or masked — this is the source of truth for who did what and when."
        actions={canExport ? <a href="/api/audit/export" className="btn-ghost">Export CSV</a> : undefined}
      >
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input
            name="q" defaultValue={q ?? ''} placeholder="Search by person or target…" aria-label="Search activity"
            className="field min-w-[220px] flex-1"
          />
          <select name="category" defaultValue={category ?? ''} aria-label="Filter by category"
            className="field w-auto">
            <option value="">All categories</option>
            {actionCategories().map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Filter</button>
          {(category || q) && <Link href="/settings/activity" className="btn-ghost">Clear</Link>}
        </form>
      </SectionCard>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted-foreground">
          {q || category ? 'No activity matches those filters.' : 'No activity recorded yet.'}
        </div>
      ) : (
        <section className="card overflow-hidden">
          <Table className="min-w-[720px]" containerClassName="scroll-thin">
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{e.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" size="sm" className="capitalize">{e.category}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.actorName || e.actorEmail
                      ? <div className="truncate font-medium text-foreground">{e.actorName || '—'}<div className="text-xs font-normal text-muted-foreground">{e.actorEmail}</div></div>
                      : <span className="text-muted-foreground">System</span>}
                    {e.ip && <div className="text-[11px] text-muted-foreground" title="Source IP">{e.ip}</div>}
                  </TableCell>
                  <TableCell><MetaCell meta={e.meta} target={e.target} action={e.action} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <span title={dateShort(e.createdAt.toISOString())}>{timeAgo(e.createdAt)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {(totalPages != null && totalPages > 1) && (
        <nav className="flex items-center justify-center gap-1.5" aria-label="Activity pages">
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => (i + 1)).map(n => (
            <Link key={n} href={`/settings/activity?page=${n}${category ? `&category=${category}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              aria-current={n === page ? 'page' : undefined}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm tabular-nums transition-colors ${n === page ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
