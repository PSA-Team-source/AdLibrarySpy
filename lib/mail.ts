// Transactional mail: verification, password reset, workspace invites.
// Send failures are surfaced to the caller — a signup that cannot deliver its
// verification mail must not report success.
import nodemailer, { type Transporter } from 'nodemailer';

const g = globalThis as unknown as { __ML_MAIL?: Transporter };

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM_EMAIL);
}

function transport(): Transporter {
  if (g.__ML_MAIL) return g.__ML_MAIL;
  const port = Number(process.env.SMTP_PORT || 587);
  g.__ML_MAIL = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // EHLO as the sending domain, not the server's own hostname, which mail
    // hosts score as a spam signal.
    name: process.env.SMTP_FROM_EMAIL?.split('@')[1] || undefined,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    pool: true,
    maxConnections: 3,
    // Stalwart closes a session after 10 messages (session.data.limits.messages, 452 4.4.5);
    // nodemailer's pool default is 100, so a digest run failed every send past the 10th.
    maxMessages: 10,
  });
  return g.__ML_MAIL;
}

export function appUrl(path = ''): string {
  const base = (process.env.APP_BASE_URL || 'http://localhost:4311').replace(/\/$/, '');
  return `${base}${path}`;
}

const FROM_NAME = process.env.SMTP_FROM_NAME || 'AdLibrarySpy';

export interface SendArgs { to: string; subject: string; heading: string; body: string; code?: string; cta?: { label: string; href: string }; footer?: string; headers?: Record<string, string>; replyTo?: string }

/** The one mail template. Exported so a job's --dry-run can write the exact HTML it would send. */
export function renderMail({ heading, body, code, cta, footer }: Omit<SendArgs, 'to' | 'subject'>): string {
  // A one-time code (lib/auth/code.ts), set large and monospaced: it is read off and typed.
  const codeRow = code
    ? `<tr><td style="padding:20px 0 4px"><div style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:14px 22px;font:600 32px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:6px;color:#111827">${code}</div></td></tr>`
    : '';
  const button = cta
    ? `<tr><td style="padding:24px 0"><a href="${cta.href}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${cta.label}</a></td></tr>`
    : '';
  const foot = footer ? `<tr><td style="color:#6b7280;font-size:12px;line-height:1.6;padding-top:8px">${footer}</td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;padding:32px;border:1px solid #e5e7eb">
<tr><td style="font-size:18px;font-weight:600;color:#111827;padding-bottom:12px">${heading}</td></tr>
<tr><td style="color:#374151;font-size:14px;line-height:1.7">${body}</td></tr>
${codeRow}
${button}
${foot}
</table>
</td></tr></table></body></html>`;
}

function message(args: SendArgs) {
  return {
    from: `"${FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: args.to,
    subject: args.subject,
    html: renderMail(args),
    text: `${args.heading}\n\n${args.body.replace(/<[^>]+>/g, '')}\n\n${args.code ? `${args.code}\n\n` : ''}${args.cta ? args.cta.href : ''}`,
    headers: args.headers,
    replyTo: args.replyTo,
  };
}

/** Transactional mail (sign-in, invites): the mailbox's own envelope, the transactional IP. */
export async function sendMail(args: SendArgs): Promise<void> {
  if (!mailConfigured()) throw new Error('SMTP is not configured');
  await transport().sendMail(message(args));
}

// ---------- marketing envelope (DTCMail IP-WARMUP.md §9/§10) ----------
// Stalwart sends mail whose ENVELOPE sender starts with `mkt-bounce.` from the
// marketing IP (167.233.188.42, stage-gated per receiver by Stalwart itself), so
// bulk mail warms that IP and never sinks sign-in mail on the transactional one.
// The From header is unchanged; the envelope is an alias of the same mailbox, so
// SPF/DKIM/DMARC alignment holds and bounces land in its inbox. Mirrors the Go
// sender (backend-v3-go/internal/adapter/river/automation_smtp.go): try
// mkt-bounce.<l>@news.<d>, then mkt-bounce.<l>@<d>, then the mailbox itself. A
// refused envelope is skipped for 10 minutes; mail is never dropped over it.
export const MARKETING_ENVELOPE_RETRY_MS = 10 * 60_000;
const refusedEnvelopes = new Map<string, number>();

export function marketingEnvelopes(from: string, now = Date.now(), refused = refusedEnvelopes): string[] {
  const i = from.lastIndexOf('@');
  if (i <= 0 || i === from.length - 1) return [from];
  const local = from.slice(0, i).toLowerCase();
  const domain = from.slice(i + 1).toLowerCase();
  const candidates = [
    ...(domain.startsWith('news.') ? [] : [`mkt-bounce.${local}@news.${domain}`]),
    `mkt-bounce.${local}@${domain}`,
  ];
  return [...candidates.filter(e => now - (refused.get(e) ?? -Infinity) >= MARKETING_ENVELOPE_RETRY_MS), from];
}

/** Bulk mail (the alerts digest): the marketing envelope, falling back as above. */
export async function sendMarketingMail(args: SendArgs): Promise<{ envelope: string }> {
  if (!mailConfigured()) throw new Error('SMTP is not configured');
  const envelopes = marketingEnvelopes(process.env.SMTP_FROM_EMAIL!);
  for (let i = 0; ; i++) {
    const env = envelopes[i];
    try {
      await transport().sendMail({ ...message(args), envelope: { from: env, to: args.to } });
      return { envelope: env };
    } catch (err) {
      const e = err as { code?: string; command?: string; message?: string };
      const refusedSender = e.code === 'EENVELOPE' && /MAIL FROM/i.test(e.command ?? '');
      if (!refusedSender || i === envelopes.length - 1) throw err;
      refusedEnvelopes.set(env, Date.now());
      // news.<domain> is expected to be refused until DTCMail's §10 subdomain is live.
      if (!env.includes('@news.')) console.warn(`[mail] marketing envelope refused (${env}); trying ${envelopes[i + 1]}: ${e.message}`);
    }
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Confirm your AdLibrarySpy address',
    heading: 'Confirm your email address',
    body: 'Click below to finish setting up your AdLibrarySpy account. The link is valid for 24 hours.',
    cta: { label: 'Confirm address', href: appUrl(`/verify?token=${encodeURIComponent(token)}`) },
    footer: 'If you did not create an AdLibrarySpy account you can ignore this message.',
  });
}

/**
 * The sign-in email: a 6-digit code to type on the page that asked for it, and a
 * link for when that page is gone. Either works, once (lib/auth/actions.ts). The
 * code leads the subject so it can be read from the notification alone.
 */
export async function sendMagicLinkEmail(to: string, token: string, o: { newAccount: boolean; minutes: number; code: string }): Promise<void> {
  // Contiguous digits: what iOS/Android one-time-code AutoFill reads out of mail.
  const code = o.code;
  await sendMail({
    to,
    subject: `${code} is your AdLibrarySpy ${o.newAccount ? 'confirmation' : 'sign-in'} code`,
    heading: o.newAccount ? 'Confirm your email to get started' : 'Sign in to AdLibrarySpy',
    body: `Enter this code on the AdLibrarySpy page where you asked for it to ${o.newAccount ? 'create your free account' : 'sign in'}. Or use the button below. The code and the link work once and expire in ${o.minutes} minutes.`,
    code,
    cta: { label: o.newAccount ? 'Create my account' : 'Sign in', href: appUrl(`/login/magic?token=${encodeURIComponent(token)}`) },
    footer: 'If you did not ask for this, ignore this email — nobody can sign in without this code or link. Never share the code.',
  });
}

/** Escape a user-supplied value for the HTML body. */
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/** A user-supplied value for a header line: no CR/LF, bounded. */
const line = (s: string, max = 60) => s.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

export async function sendEmailChangeLink(to: string, newEmail: string, token: string, minutes: number): Promise<void> {
  await sendMail({
    to,
    subject: 'Approve the change to your AdLibrarySpy sign-in address',
    heading: 'Approve the email change',
    body: `Someone signed in to your account asked to change its sign-in address to <b>${esc(newEmail)}</b>. Nothing changes unless you approve here and the new address then confirms too. The link expires in ${minutes} minutes.`,
    cta: { label: 'Approve the change', href: appUrl(`/login/magic?token=${encodeURIComponent(token)}`) },
    footer: 'If this was not you, ignore this email — your address stays the same — and sign out other devices from Settings › Security.',
  });
}

/** Second step of an email change: proves the NEW inbox belongs to the requester. */
export async function sendNewEmailConfirmLink(to: string, token: string, minutes: number): Promise<void> {
  await sendMail({
    to,
    subject: 'Confirm your new AdLibrarySpy sign-in address',
    heading: 'Confirm your new email address',
    body: `An AdLibrarySpy account asked to use <b>${esc(to)}</b> as its sign-in address, and its current address approved. Confirm below to finish. The link expires in ${minutes} minutes.`,
    cta: { label: 'Confirm this address', href: appUrl(`/login/magic?token=${encodeURIComponent(token)}`) },
    footer: 'If you did not ask for this, ignore this email — nothing changes without your confirmation.',
  });
}

export async function sendInviteEmail(to: string, workspace: string, inviter: string, token: string): Promise<void> {
  await sendMail({
    to,
    subject: `${line(inviter)} invited you to ${line(workspace)} on AdLibrarySpy`,
    heading: `Join ${esc(workspace)}`,
    body: `${esc(inviter)} has invited you to collaborate in the <b>${esc(workspace)}</b> workspace on AdLibrarySpy. The invitation expires in 7 days.`,
    cta: { label: 'Accept invitation', href: appUrl(`/invite?token=${encodeURIComponent(token)}`) },
  });
}
