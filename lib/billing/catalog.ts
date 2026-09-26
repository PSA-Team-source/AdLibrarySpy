import { one, query } from '@/lib/db';

export interface PlanCatalogRow {
  id: string;
  name: string;
  blurb: string;
  priceCents: number;
  seatsIncluded: number;
  extraSeatCents: number;
  isPublic: boolean;
}

export interface BillingSummary {
  currentPlan: PlanCatalogRow;
  subscription: {
    status: string;
    interval: string;
    quantity: number;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  invoices: {
    id: string;
    number: string | null;
    description: string;
    amountPaidCents: number;
    amountDueCents: number;
    currency: string;
    status: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    createdAt: Date;
  }[];
}

const PLAN_COLUMNS = `p.id, p.name, p.blurb, p.price_cents AS "priceCents",
  p.seats_included AS "seatsIncluded", p.extra_seat_cents AS "extraSeatCents",
  p.is_public AS "isPublic"`;

export async function publicPlanCatalog(): Promise<PlanCatalogRow[]> {
  return query<PlanCatalogRow>(`SELECT ${PLAN_COLUMNS} FROM plans p WHERE p.is_public ORDER BY p.sort_order`);
}

export async function billingSummary(workspaceId: string): Promise<BillingSummary | null> {
  const currentPlan = await one<PlanCatalogRow>(
    `SELECT ${PLAN_COLUMNS} FROM workspaces w JOIN plans p ON p.id = w.plan_id WHERE w.id = $1`,
    [workspaceId],
  );
  if (!currentPlan) return null;

  const [subscription, invoices] = await Promise.all([
    one<BillingSummary['subscription'] & Record<string, never>>(
      `SELECT status, interval, quantity,
              current_period_start AS "currentPeriodStart",
              current_period_end AS "currentPeriodEnd",
              cancel_at_period_end AS "cancelAtPeriodEnd"
         FROM subscriptions
        WHERE workspace_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [workspaceId],
    ),
    query<BillingSummary['invoices'][number]>(
      `SELECT stripe_invoice_id AS id, number, description,
              amount_paid_cents AS "amountPaidCents", amount_due_cents AS "amountDueCents",
              currency, status, hosted_invoice_url AS "hostedInvoiceUrl",
              invoice_pdf AS "invoicePdf", created_at AS "createdAt"
         FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 24`,
      [workspaceId],
    ),
  ]);

  return { currentPlan, subscription: subscription ?? null, invoices };
}
