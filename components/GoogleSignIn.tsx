'use client';
// Sign in with Google, the PlatformDTC way (frontend-v3 GoogleOneTap +
// sign-in-dialog): Google Identity Services renders its official button and
// offers One Tap; the ID token it returns goes to googleSignInAction, which
// verifies it server-side and signs in or creates the account.
// Nothing renders — not even the "or" divider — until Google's button does, so
// a blocked script or an unset client id leaves just the email form.
// `oneTapOnly` (homepage): no button, just Google's One Tap prompt, and only on
// a browser without the als_in signed-in hint (lib/auth/session.ts) — the page
// is edge-cached, so the server cannot know who is looking.
// In a social app's in-app browser (Facebook, Instagram, …) Google refuses the
// sign-in (lib/public/in-app-browser.ts), so there is no button and no One Tap:
// a short note points to the email form, plus a hand-off to the phone's browser
// on Android, where the webview supports one.
import { useEffect, useRef, useState, useTransition } from 'react';
import { googleSignInAction } from '@/lib/auth/actions';
import { inAppBrowser, openInBrowserHref, handoffUrl } from '@/lib/public/in-app-browser';

interface Gsi {
  initialize(o: Record<string, unknown>): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
}
declare global { interface Window { google?: { accounts?: { id?: Gsi } } } }

const SRC = 'https://accounts.google.com/gsi/client';

function loadGsi(): Promise<Gsi> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (!s) {
      s = document.createElement('script');
      s.src = SRC; s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gsi')));
    s.addEventListener('error', () => reject(new Error('gsi')));
  });
}

export function GoogleSignIn({ clientId, next, landing, context, oneTapOnly = false }: {
  clientId: string; next?: string | null; landing?: string | null; context: 'signin' | 'signup';
  oneTapOnly?: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState<{ app: string; href: string | null } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const app = inAppBrowser(navigator.userAgent);
    if (app) {
      if (!oneTapOnly) setInApp({ app, href: openInBrowserHref(navigator.userAgent, handoffUrl(location.href, document.cookie)) });
      return;
    }
    if (oneTapOnly && /(?:^|;\s*)als_in=/.test(document.cookie)) return;
    loadGsi().then((gsi) => {
      if (!live || (!oneTapOnly && !slot.current)) return;
      gsi.initialize({
        client_id: clientId,
        context,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
        callback: ({ credential }: { credential: string }) => {
          setError(null);
          start(async () => {
            // Success redirects; only a refusal comes back.
            const r = await googleSignInAction(credential, next ?? null, landing ?? null);
            if (r?.error) setError(r.error);
          });
        },
      });
      if (!oneTapOnly && slot.current) {
        const dark = document.documentElement.classList.contains('dark');
        gsi.renderButton(slot.current, {
          type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'rectangular',
          text: context === 'signup' ? 'signup_with' : 'continue_with', logo_alignment: 'center',
          width: Math.max(200, Math.min(400, Math.floor(slot.current.clientWidth))),
        });
        setReady(true);
      }
      gsi.prompt();
    }).catch(() => { /* no Google: the email form stands alone */ });
    return () => { live = false; try { window.google?.accounts?.id?.cancel(); } catch { /* gone */ } };
  }, [clientId, context, next, landing, oneTapOnly]);

  if (oneTapOnly) {
    // One Tap is Google's own overlay; only a refusal needs our UI.
    return error ? <p role="alert" className="alert-error fixed right-4 top-4 z-[60] max-w-sm">{error}</p> : null;
  }
  if (inApp) {
    return (
      <p className="mb-5 rounded-lg border border-border bg-[var(--surface)] px-3 py-2.5 text-sm text-muted-foreground">
        Google sign-in doesn&apos;t work inside the {inApp.app} app. Use your email below
        {inApp.href
          ? <>, or <a href={inApp.href} className="font-medium text-foreground underline">open this page in your browser</a>.</>
          : <> — or open this page in your browser from the app&apos;s menu.</>}
      </p>
    );
  }
  return (
    <div className="mb-5">
      {error && <p role="alert" className="alert-error mb-3">{error}</p>}
      <div ref={slot} aria-busy={pending} className={`flex min-h-0 justify-center ${pending ? 'pointer-events-none opacity-60' : ''}`} />
      {ready && (
        <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  );
}
