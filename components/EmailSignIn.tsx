'use client';
// Email sign-in/sign-up in two steps on ONE page: the address (plus any signup
// fields the caller passes as children), then the 6-digit code from the email
// (lib/auth/code.ts). Typing the code keeps the visitor in the browser they are
// in — the emailed link opens in the mail app's browser, which loses a
// Facebook/Instagram in-app session. The link in the same email still works.
// Both steps call server actions directly, so a form sent before hydration is a
// plain POST (progressive enhancement), never a GET that puts the address in a URL.
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestMagicLinkAction, verifyEmailCodeAction, type FormState } from '@/lib/auth/actions';

const RESEND_SECONDS = 30;

export type EmailSignInVariant = 'card' | 'hero';

/** Class names per surface: the auth card (theme tokens) or the dark homepage hero. */
const SKIN: Record<EmailSignInVariant, { input: string; button: string; error: string; ok: string; muted: string; link: string; code: string }> = {
  card: {
    input: 'field', button: 'btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60',
    error: 'alert-error', ok: 'alert-success', muted: 'text-muted-foreground', link: 'font-medium text-foreground hover:underline',
    code: 'field text-center font-mono text-2xl tracking-[0.5em]',
  },
  hero: {
    input: 'h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-base text-white placeholder:text-white/45 focus:border-[#a7f45a] focus:outline-none focus:ring-2 focus:ring-[#a7f45a]/30',
    button: 'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[4px] bg-[#a7f45a] px-8 text-sm font-medium text-[#071004] transition-colors hover:bg-[#bcfb7c] disabled:cursor-not-allowed disabled:opacity-70',
    error: 'rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-left text-sm text-red-200',
    ok: 'text-left text-sm text-white/80', muted: 'text-white/55', link: 'font-medium text-white underline-offset-2 hover:underline',
    code: 'h-14 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-white/25 focus:border-[#a7f45a] focus:outline-none focus:ring-2 focus:ring-[#a7f45a]/30',
  },
};

function Submit({ label, pendingLabel, className }: { label: React.ReactNode; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? pendingLabel : label}</button>;
}

export function EmailSignIn({ children, submitLabel, pendingLabel, variant = 'card', layout = 'stack' }: {
  /** The email field and any other inputs of the first step. */
  children: React.ReactNode;
  submitLabel: React.ReactNode; pendingLabel: string;
  variant?: EmailSignInVariant;
  /** 'inline': field and button on one row from `sm` up (homepage hero). */
  layout?: 'stack' | 'inline';
}) {
  const skin = SKIN[variant];
  const [sent, sendAction] = useActionState(requestMagicLinkAction, {} as FormState);
  // The first step's fields, replayed by "Send a new code".
  const lastForm = useRef<FormData | null>(null);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);

  useEffect(() => {
    if (sent.sentTo) { setCodeFor(sent.sentTo); setSentAt(Date.now()); }
  }, [sent]);

  if (codeFor) {
    return (
      // Keyed by send: a new code starts a clean step (no stale "not right" error).
      <CodeStep
        key={sentAt}
        email={codeFor} skin={skin} sentAt={sentAt}
        // A resend that was refused (rate limit, mail down) says why, in place.
        resendError={sent.sentTo ? undefined : sent.error}
        onResend={() => {
          // No captured form when the first step was posted before hydration.
          const fd = lastForm.current ?? new FormData();
          if (!lastForm.current) fd.set('email', codeFor);
          startTransition(() => sendAction(fd));
        }}
        onChangeEmail={() => setCodeFor(null)}
      />
    );
  }

  return (
    <form action={sendAction} onSubmit={(e) => { lastForm.current = new FormData(e.currentTarget); }}
      className={layout === 'inline' ? 'space-y-3' : 'space-y-4'}>
      {sent.error && <p role="alert" className={skin.error}>{sent.error}</p>}
      {layout === 'inline'
        ? <div className="flex flex-col gap-2.5 sm:flex-row">{children}<Submit label={submitLabel} pendingLabel={pendingLabel} className={skin.button} /></div>
        : <>{children}<Submit label={submitLabel} pendingLabel={pendingLabel} className={skin.button} /></>}
    </form>
  );
}

function CodeStep({ email, skin, sentAt, resendError, onResend, onChangeEmail }: {
  email: string; skin: (typeof SKIN)[EmailSignInVariant]; sentAt: number; resendError?: string;
  onResend: () => void; onChangeEmail: () => void;
}) {
  const [state, verify] = useActionState(verifyEmailCodeAction, {} as FormState);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  // A refused code is selected, so typing again replaces it.
  useEffect(() => { if (state.error) input.current?.select(); }, [state]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  const take = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Six digits (typed, pasted or AutoFilled from the email) submit on their own.
    if (digits.length === 6) requestAnimationFrame(() => form.current?.requestSubmit());
  };

  return (
    <div className="space-y-4 text-left">
      <p role="status" className={skin.ok}>
        We sent a 6-digit code to <b className="break-all">{email}</b>. Enter it here, or open the link in the email.
      </p>
      <form ref={form} action={verify} className="space-y-3">
        {state.error && <p role="alert" className={skin.error}>{state.error}</p>}
        {resendError && <p role="alert" className={skin.error}>{resendError}</p>}
        <input type="hidden" name="email" value={email} />
        <label className="block">
          <span className="sr-only">6-digit code</span>
          <input
            ref={input} name="code" value={code} required
            inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
            placeholder="000000" aria-label="6-digit code" className={skin.code}
            onChange={(e) => take(e.target.value)}
            // A paste like "123 456" or "Code: 123456" is longer than maxLength: take its digits.
            onPaste={(e) => { e.preventDefault(); take(e.clipboardData.getData('text')); }}
          />
        </label>
        <Submit label="Continue" pendingLabel="Checking…" className={`${skin.button} w-full`} />
      </form>
      <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${skin.muted}`}>
        {wait > 0
          ? <span>Send a new code in {wait}s</span>
          : <button type="button" onClick={onResend} className={skin.link}>Send a new code</button>}
        <button type="button" onClick={onChangeEmail} className={skin.link}>Use a different email</button>
      </p>
    </div>
  );
}
