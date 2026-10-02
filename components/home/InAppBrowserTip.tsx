'use client';
// One line on Home for people signed in inside Facebook/Instagram/TikTok's browser,
// where the session disappears with the app's webview. Offers a sign-in link by
// email, which opens in their real browser. The server decides from the
// User-Agent (lib/public/in-app-browser.ts), so nobody else ever sees it.
import { useState, useTransition } from 'react';
import { emailBrowserLinkAction } from './actions';

export function InAppBrowserTip({ app }: { app: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <p role="status" className="w-full text-center text-sm text-muted-foreground">{msg.ok}</p>;
  return (
    <p className="w-full text-center text-sm text-muted-foreground">
      You&apos;re inside the {app} app, so it may sign you out.{' '}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMsg(await emailBrowserLinkAction().catch(() => ({ error: 'Something went wrong. Try again.' }))))}
        className="font-medium text-foreground underline disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Get a sign-in link by email'}
      </button>{' '}
      to open AdLibrarySpy in your browser.
      {msg?.error && <span role="alert" className="block text-destructive">{msg.error}</span>}
    </p>
  );
}
