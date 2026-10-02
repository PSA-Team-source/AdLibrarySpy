import Link from 'next/link';
import { requireCtx } from '@/lib/auth/guard';
import { one } from '@/lib/db';
import { PageShell } from '@/components/layouts/page-shell';
import { SectionCard } from '@/components/ui/section-card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { listSavedSearches } from '@/lib/saved-searches';
import { describeQuery, DEFAULT_FREQUENCY } from '@/lib/alerts/digest';
import { dateShort } from '@/lib/format';
import { AlertToggle, DeleteSearch, RenameSearch } from './row-actions';

export const metadata = { title: 'Saved searches' };
export const dynamic = 'force-dynamic';

const FREQ_LABEL: Record<string, string> = { daily: 'daily', weekly: 'every Monday', off: 'off' };

export default async function SavedSearchesPage() {
  const ctx = await requireCtx();
  const [searches, prefs] = await Promise.all([
    listSavedSearches(ctx.workspaceId, ctx.user.id),
    one<{ frequency: string; searches: boolean }>('SELECT frequency, searches FROM alert_prefs WHERE user_id = $1', [ctx.user.id]),
  ]);
  const frequency = prefs?.frequency ?? DEFAULT_FREQUENCY;
  const mailing = frequency !== 'off' && (prefs?.searches ?? true);

  return (
    <PageShell title="Saved searches">
      <SectionCard
        title="Your saved searches"
        description={mailing
          ? `Searches with the alert on email you new results ${FREQ_LABEL[frequency]}.`
          : 'Search alert emails are off.'}
        actions={<Link href="/settings/notifications" className="btn-ghost h-9 px-4 text-sm">Notification settings</Link>}
        padded={searches.length === 0}
      >
        {searches.length === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Filter <Link href="/shops" className="font-medium text-foreground underline underline-offset-2">Shops</Link> or <Link href="/ads" className="font-medium text-foreground underline underline-offset-2">Ads</Link>, then press <span className="font-medium text-foreground">Save search</span> to keep the filters and get new results by email.</p>
          </div>
        ) : (
          <Table className="sm:min-w-[640px] max-sm:[&_tr>*:nth-child(2):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(3):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(4):not([colspan])]:hidden" containerClassName="scroll-thin">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Filters</TableHead>
                <TableHead>Saved</TableHead><TableHead>Alert</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-[240px]">
                    <Link href={`/${s.kind}${s.query ? `?${s.query}` : ''}`} className="block truncate font-medium text-foreground hover:underline">{s.name}</Link>
                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{s.kind === 'shops' ? 'Shops' : 'Ads'} · {describeQuery(s.query)}</span>
                  </TableCell>
                  <TableCell><span className="pill">{s.kind === 'shops' ? 'Shops' : 'Ads'}</span></TableCell>
                  <TableCell className="max-w-[320px]"><span className="block truncate text-muted-foreground" title={describeQuery(s.query)}>{describeQuery(s.query)}</span></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateShort(s.createdAt.toISOString())}</TableCell>
                  <TableCell><AlertToggle id={s.id} on={s.alert} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <RenameSearch id={s.id} name={s.name} />
                      <DeleteSearch id={s.id} name={s.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageShell>
  );
}
