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
  });
  return g.__ML_MAIL;
}

export function appUrl(path = ''): string {
  const base = (process.env.APP_BASE_URL || 'http://localhost:4311').replace(/\/$/, '');
  return `${base}${path}`;
}

const FROM_NAME = process.env.SMTP_FROM_NAME || 'AdLibrarySpy';

interface SendArgs { to: string; subject: string; heading: string; body: string; cta?: { label: string; href: string }; footer?: string; headers?: Record<string, string> }

function render({ heading, body, cta, footer }: Omit<SendArgs, 'to' | 'subject'>): string {
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
${button}
${foot}
</table>
</td></tr></table></body></html>`;
}

export async function sendMail(args: SendArgs): Promise<void> {
  if (!mailConfigured()) throw new Error('SMTP is not configured');
  await transport().sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: args.to,
    subject: args.subject,
    html: render(args),
    text: `${args.heading}\n\n${args.body.replace(/<[^>]+>/g, '')}\n\n${args.cta ? args.cta.href : ''}`,
    headers: args.headers,
  });
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

export async function sendMagicLinkEmail(to: string, token: string, o: { newAccount: boolean; minutes: number }): Promise<void> {
  await sendMail({
    to,
    subject: o.newAccount ? 'Finish creating your AdLibrarySpy account' : 'Your AdLibrarySpy sign-in link',
    heading: o.newAccount ? 'Confirm your email to get started' : 'Sign in to AdLibrarySpy',
    body: `Use the button below to ${o.newAccount ? 'create your free account' : 'sign in'}. The link works once and expires in ${o.minutes} minutes.`,
    cta: { label: o.newAccount ? 'Create my account' : 'Sign in', href: appUrl(`/login/magic?token=${encodeURIComponent(token)}`) },
    footer: 'If you did not ask for this, ignore this email — nobody can sign in without the link.',
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
