'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { MARKET_MIN_JUMP, VISITS_MATERIAL_PCT, type AlertFrequency } from '@/lib/alerts/digest';
import { saveNotificationsAction, type NotificationsState } from './actions';

const OPTIONS: { value: AlertFrequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Around 13:00 UTC, covering the last 24 hours.' },
  { value: 'weekly', label: 'Weekly', hint: 'Mondays around 13:00 UTC, covering the last 7 days.' },
  { value: 'off', label: 'Off', hint: 'No alert emails.' },
];

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary h-9 px-4">{pending ? 'Saving…' : 'Save'}</button>;
}

export function NotificationsForm({ frequency, trackers, searches, market }: { frequency: AlertFrequency; trackers: boolean; searches: boolean; market: boolean }) {
  const [state, action] = useActionState<NotificationsState, FormData>(saveNotificationsAction, {});
  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">How often</legend>
        {OPTIONS.map(o => (
          <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-[var(--primaryColor)]">
            <input type="radio" name="frequency" value={o.value} defaultChecked={o.value === frequency} className="mt-0.5 h-4 w-4 accent-[var(--primaryColor)]" />
            <span>
              <span className="block text-sm font-medium text-foreground">{o.label}</span>
              <span className="block text-sm text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="mb-2 text-sm font-medium text-foreground">What to include</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="trackers" defaultChecked={trackers} className="mt-0.5 h-4 w-4 accent-[var(--primaryColor)]" />
          <span>
            <span className="font-medium text-foreground">Brandtracker changes</span>
            <span className="block text-muted-foreground">New ads launched, live-ad changes, traffic moves of {VISITS_MATERIAL_PCT}% or more, and product-count changes for the brands your workspaces track.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="searches" defaultChecked={searches} className="mt-0.5 h-4 w-4 accent-[var(--primaryColor)]" />
          <span>
            <span className="font-medium text-foreground">Saved-search results</span>
            <span className="block text-muted-foreground">New shops and ads matching the saved searches you turned the alert on for.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="market" defaultChecked={market} className="mt-0.5 h-4 w-4 accent-[var(--primaryColor)]" />
          <span>
            <span className="font-medium text-foreground">Today in the market</span>
            <span className="block text-muted-foreground">Stores that added {MARKET_MIN_JUMP}+ live Meta ads the day before, in your niche when we know it from the stores you track and save.</span>
          </span>
        </label>
      </fieldset>
      <p className="text-sm text-muted-foreground">An email is only sent when something changed. Every alert email has a one-click unsubscribe link.</p>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p role="status" className="alert-success">{state.ok}</p>}
      <div className="flex justify-end"><Submit /></div>
    </form>
  );
}
