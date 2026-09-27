'use client';
// "Save search" for /shops and /ads: stores the current URL filter set under a
// name, optionally with an email alert for new results (scripts/alerts-digest.mjs).
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookmarkPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { describeQuery, normalizeQuery, type SearchKind } from '@/lib/alerts/digest';
import { saveSearchAction, type SaveSearchState } from '@/app/(app)/searches/actions';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary h-9 px-4">{pending ? 'Saving…' : 'Save search'}</button>;
}

export function SaveSearchButton({ kind }: { kind: SearchKind }) {
  const params = useSearchParams();
  const query = normalizeQuery(params.toString());
  // Bumped on every open: the form remounts, so the last save's message never lingers.
  const [opens, setOpens] = useState(0);

  if (!query) return null; // nothing filtered = nothing worth saving
  const summary = describeQuery(query);
  const suggested = (params.get('q') || params.get('store') || (kind === 'shops' ? 'Shops search' : 'Ads search')).slice(0, 80);

  return (
    <Dialog onOpenChange={o => { if (o) setOpens(n => n + 1); }}>
      <DialogTrigger asChild>
        <button type="button" className="btn-ghost h-9 gap-1.5 px-3 text-sm" title="Save these filters">
          <BookmarkPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Save search</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save search</DialogTitle>
          <DialogDescription className="break-words">{summary}</DialogDescription>
        </DialogHeader>
        <SaveForm key={opens} kind={kind} query={query} suggested={suggested} />
      </DialogContent>
    </Dialog>
  );
}

function SaveForm({ kind, query, suggested }: { kind: SearchKind; query: string; suggested: string }) {
  const [shown, action] = useActionState<SaveSearchState, FormData>(saveSearchAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="query" value={query} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">Name</span>
        <input name="name" required maxLength={80} defaultValue={suggested} className="field" autoFocus />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="alert" defaultChecked className="mt-0.5 h-4 w-4 accent-[var(--primaryColor)]" />
        <span>
          <span className="font-medium text-foreground">Email me new results</span>
          <span className="block text-muted-foreground">Included in your alert digest. Frequency is set in <Link href="/settings/notifications" className="underline underline-offset-2">Settings → Notifications</Link>.</span>
        </span>
      </label>
      {shown.error && <p role="alert" className="alert-error">{shown.error}</p>}
      {shown.ok && <p role="status" className="alert-success">{shown.ok} <Link href="/searches" className="font-medium underline underline-offset-2">View saved searches</Link></p>}
      <div className="flex justify-end"><Submit /></div>
    </form>
  );
}
