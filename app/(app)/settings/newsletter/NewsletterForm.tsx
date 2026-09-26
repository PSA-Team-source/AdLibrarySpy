'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setNewsletterAction, type NewsletterState } from './actions';

function Toggle({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label="Email me the weekly report"
      disabled={pending}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${on ? 'bg-[var(--primaryColor)]' : 'bg-muted'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function NewsletterForm({ subscribed }: { subscribed: boolean }) {
  const [state, action] = useActionState<NewsletterState, FormData>(setNewsletterAction, {});
  return (
    <form action={action} className="space-y-4">
      {/* The switch submits the opposite of the current state. */}
      <input type="hidden" name="subscribe" value={subscribed ? '0' : '1'} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Email me the weekly report</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every Monday: top scaling stores, fastest traffic growth, biggest ad peaks and the newest winners. One email a week, unsubscribe in one click.
          </p>
        </div>
        <Toggle on={subscribed} />
      </div>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p role="status" className="alert-success">{state.ok}</p>}
    </form>
  );
}
