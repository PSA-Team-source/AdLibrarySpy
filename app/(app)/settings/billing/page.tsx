import { requireCtx } from '@/lib/auth/guard';
import { billingSummary, publicPlanCatalog } from '@/lib/billing/catalog';
import { dateShort } from '@/lib/format';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Plans & Billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const ctx = await requireCtx();
  const [summary, plans] = await Promise.all([billingSummary(ctx.workspaceId), publicPlanCatalog()]);
  if (!summary) throw new Error('Workspace plan is missing');
  const sub = summary.subscription;

  return (
    <div className="space-y-6">
      <SectionCard title="Plans & Billing" description="Your workspace plan, subscription period, seats, and invoices.">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-foreground">{summary.currentPlan.name}</span>
              {sub?.status && <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">{sub.status.replace('_', ' ')}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{summary.currentPlan.blurb}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-foreground">${(summary.currentPlan.priceCents / 100).toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">per month</div>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Billing interval</dt><dd className="mt-1 font-medium capitalize">{sub?.interval ?? 'No subscription'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Seats</dt><dd className="mt-1 font-medium">{sub?.quantity ?? summary.currentPlan.seatsIncluded}</dd></div>
          {sub?.currentPeriodStart && <div><dt className="text-xs text-muted-foreground">Period started</dt><dd className="mt-1 font-medium">{dateShort(sub.currentPeriodStart.toISOString())}</dd></div>}
          {sub?.currentPeriodEnd && <div><dt className="text-xs text-muted-foreground">{sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</dt><dd className="mt-1 font-medium">{dateShort(sub.currentPeriodEnd.toISOString())}</dd></div>}
        </dl>
      </SectionCard>

      <SectionCard title="Available plans" description="Monthly list prices recorded in the plan catalog.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map(plan => {
            const current = plan.id === summary.currentPlan.id;
            return (
              <div key={plan.id} className={cn('rounded-xl border border-border p-5', current && 'border-[var(--primaryColor)] ring-1 ring-[var(--primaryColor)]')}>
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-foreground">{plan.name}</h3>{current && <Badge variant="secondary">Current plan</Badge>}</div>
                <div className="mt-4"><span className="text-3xl font-semibold tabular-nums text-foreground">${(plan.priceCents / 100).toFixed(0)}</span><span className="text-sm text-muted-foreground">/month</span></div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.blurb}</p>
                <p className="mt-4 text-xs text-muted-foreground">{plan.seatsIncluded} seat{plan.seatsIncluded === 1 ? '' : 's'} included{plan.extraSeatCents > 0 ? ` · +$${(plan.extraSeatCents / 100).toFixed(0)}/extra seat` : ''}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Invoices" padded={false}>
        {summary.invoices.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No invoices have been issued for this workspace.</p> : (
          <Table className="sm:min-w-[620px] max-sm:[&_tr>*:nth-child(2):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(4):not([colspan])]:hidden" containerClassName="scroll-thin">
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Receipt</TableHead></TableRow></TableHeader>
            <TableBody>{summary.invoices.map(invoice => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium text-foreground">{invoice.number || invoice.description}<span className="block text-xs font-normal text-muted-foreground sm:hidden">{dateShort(invoice.createdAt.toISOString())} · <span className="capitalize">{invoice.status}</span></span></TableCell>
                <TableCell>{dateShort(invoice.createdAt.toISOString())}</TableCell>
                <TableCell className="text-right tabular-nums">${((invoice.amountPaidCents || invoice.amountDueCents) / 100).toFixed(2)} {invoice.currency.toUpperCase()}</TableCell>
                <TableCell><Badge variant={invoice.status === 'paid' ? 'success' : 'secondary'} className="capitalize">{invoice.status}</Badge></TableCell>
                <TableCell className="text-right">{invoice.invoicePdf ? <a href={invoice.invoicePdf} target="_blank" rel="noopener noreferrer" className="hover:underline">PDF</a> : invoice.hostedInvoiceUrl ? <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">View</a> : null}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
