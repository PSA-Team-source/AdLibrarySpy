'use server';
// In-app feedback: the header's "Feedback" dialog (components/FeedbackDialog).
// The `feedback` row is the record (migration 019); the email to the team is a
// copy with Reply-To set to the sender, so answering it answers them.
import { query, one } from '@/lib/db';
import { requireCtx, audit } from '@/lib/auth/guard';
import { FAIR_USE, spendQuotas } from '@/lib/ratelimit';
import { sendMail, mailConfigured } from '@/lib/mail';

export interface FeedbackState { error?: string; ok?: string }

const FEEDBACK_TO = process.env.FEEDBACK_EMAIL || 'sang@psa.team';
const MAX = 5000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface Row { id: string; email: string; page: string | null; message: string; workspace_name: string | null; created_at: Date }

async function forward(r: Row): Promise<void> {
  const first = r.message.split('\n')[0].slice(0, 60);
  await sendMail({
    to: FEEDBACK_TO,
    replyTo: r.email,
    subject: `AdLibrarySpy feedback: ${first}${r.message.length > first.length ? '…' : ''}`,
    heading: `Feedback from ${esc(r.email)}`,
    body: `<div style="white-space:pre-wrap">${esc(r.message)}</div>`
      + `<p style="color:#6b7280;font-size:12px;margin-top:16px">Workspace: ${esc(r.workspace_name ?? '—')}<br>Page: ${esc(r.page ?? '—')}<br>Sent: ${r.created_at.toISOString()} · #${r.id}</p>`,
    footer: 'Reply to this email to answer the sender directly.',
  });
}

export async function sendFeedbackAction(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const ctx = await requireCtx();
  const message = String(form.get('message') ?? '').trim();
  const page = String(form.get('page') ?? '').slice(0, 300) || null;
  if (!message) return { error: 'Write your feedback first.' };
  if (message.length > MAX) return { error: `Keep it under ${MAX.toLocaleString('en-US')} characters.` };

  const rl = await spendQuotas(FAIR_USE.feedback(ctx.user.id));
  if (!rl.allowed) return { error: 'You have sent a lot of feedback this hour. Try again later.' };

  const row = await one<{ id: string }>(
    'INSERT INTO feedback (user_id, workspace_id, email, page, message) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [ctx.user.id, ctx.workspaceId, ctx.user.email, page, message],
  );
  await audit(ctx, 'feedback.sent', row?.id);

  // Forward this one and any earlier message a mail outage left unsent (oldest
  // first). Rows are claimed (emailed_at set) before sending so two concurrent
  // submissions never mail the same row; a failed send releases its claim, and
  // the row is already saved, so an outage only delays the copy.
  if (mailConfigured()) {
    const claimed = await query<Row>(
      `WITH c AS (
         UPDATE feedback SET emailed_at = now()
          WHERE id IN (SELECT id FROM feedback WHERE emailed_at IS NULL ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
          RETURNING id, email, page, message, workspace_id, created_at)
       SELECT c.id, c.email, c.page, c.message, w.name AS workspace_name, c.created_at
         FROM c LEFT JOIN workspaces w ON w.id = c.workspace_id ORDER BY c.created_at`,
    );
    for (const [i, r] of claimed.entries()) {
      try { await forward(r); } catch (e) {
        console.error('[feedback] forward failed', r.id, (e as Error).message);
        await query('UPDATE feedback SET emailed_at = NULL WHERE id = ANY($1::bigint[])', [claimed.slice(i).map(x => x.id)]);
        break;
      }
    }
  }
  return { ok: 'Thanks! Your feedback reached the team. We reply by email when there is something to follow up on.' };
}
