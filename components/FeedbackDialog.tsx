'use client';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { usePathname } from 'next/navigation';
import { sendFeedbackAction, type FeedbackState } from '@/lib/feedback';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { REPO_URL } from '@/lib/public/site';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? 'Sending…' : 'Send feedback'}
    </button>
  );
}

/** The header's "Feedback" dialog; lib/feedback.ts stores it and emails the team. */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname() ?? '';
  // A fresh form state per opening, so a past "Thanks" never greets the next message.
  const [session, setSession] = useState(0);
  useEffect(() => { if (open) setSession((n) => n + 1); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            A bug, a missing filter, a data source we should add: it goes straight to the team, and we reply to your account email.
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm key={session} page={pathname} />
        <p className="text-xs text-muted-foreground">
          Prefer public? <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener" className="underline hover:text-foreground">Open an issue on GitHub</a>.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackForm({ page }: { page: string }) {
  const [state, action] = useActionState<FeedbackState, FormData>(sendFeedbackAction, {});
  if (state.ok) return <p role="status" className="alert-success">{state.ok}</p>;
  return (
    <form action={action} className="space-y-3">
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      <input type="hidden" name="page" value={page} />
      <label className="block">
        <span className="sr-only">Your feedback</span>
        <textarea name="message" required maxLength={5000} rows={6} autoFocus
          placeholder="What should we fix or add?" className="field min-h-[140px] resize-y" />
      </label>
      <Submit />
    </form>
  );
}
