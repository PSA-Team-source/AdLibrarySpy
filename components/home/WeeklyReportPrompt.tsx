'use client';
// One small line on Home offering the Monday report by email. Shown only to
// people who never made a choice about it (no newsletter_subscribers row; the
// server decides), and gone for good once they subscribe or close it (the close
// is remembered in this browser). Nobody is ever subscribed without this click.
import { useEffect, useState, useTransition } from 'react';
import { setNewsletterAction } from '@/app/(app)/settings/newsletter/actions';

const KEY = 'als:weekly-prompt-closed';

export function WeeklyReportPrompt() {
  const [hidden, setHidden] = useState(true);              // stay hidden until we know it was not closed
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === '1'); } catch { setHidden(false); }
  }, []);
  if (hidden) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* still closes for this visit */ } setHidden(true); };
  if (msg?.ok) return <p role="status" className="w-full text-center text-sm text-muted-foreground">{msg.ok}</p>;
  const subscribe = () => start(async () => {
    const f = new FormData();
    f.set('subscribe', '1');
    setMsg(await setNewsletterAction({}, f).catch(() => ({ error: 'Something went wrong. Try again.' })));
  });
  return (
    <p className="w-full text-center text-sm text-muted-foreground">
      Get the stores scaling right now in your inbox every Monday.{' '}
      <button type="button" disabled={pending} onClick={subscribe} className="font-medium text-foreground underline disabled:opacity-60">
        {pending ? 'Saving…' : 'Email me the weekly report'}
      </button>
      {' · '}
      <button type="button" onClick={close} className="underline">No thanks</button>
      {msg?.error && <span role="alert" className="block text-destructive">{msg.error}</span>}
    </p>
  );
}
