'use server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireCtx, audit } from '@/lib/auth/guard';

export interface NewsletterState { error?: string; ok?: string }

/** Explicit opt-in / opt-out for the weekly report. Consent is only ever set here. */
export async function setNewsletterAction(_prev: NewsletterState, form: FormData): Promise<NewsletterState> {
  const ctx = await requireCtx();
  const on = form.get('subscribe') === '1';
  if (on) {
    await query(
      `INSERT INTO newsletter_subscribers (user_id, subscribed_at, unsubscribed_at, source)
       VALUES ($1, now(), NULL, 'settings')
       ON CONFLICT (user_id) DO UPDATE SET subscribed_at = now(), unsubscribed_at = NULL, source = 'settings'`,
      [ctx.user.id],
    );
  } else {
    await query(
      'UPDATE newsletter_subscribers SET unsubscribed_at = now() WHERE user_id = $1 AND unsubscribed_at IS NULL',
      [ctx.user.id],
    );
  }
  await audit(ctx, on ? 'newsletter.subscribed' : 'newsletter.unsubscribed');
  revalidatePath('/settings/newsletter');
  return on
    ? { ok: ctx.user.emailVerifiedAt ? 'Subscribed. The next report arrives Monday.' : 'Subscribed. Confirm your email address and the report will start arriving on Mondays.' }
    : { ok: 'Unsubscribed. You will not get the weekly report.' };
}
