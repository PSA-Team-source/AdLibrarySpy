'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { renameWorkspaceAction, removeWorkspaceAction, type ActionState } from '@/lib/workspace';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function Submit({ label, pendingLabel, disabled = false, className = 'btn-primary w-full justify-center' }: { label: string; pendingLabel: string; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>{pending ? pendingLabel : label}</button>;
}

function Messages({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p role="status" className="alert-success">{state.ok}</p>}
    </>
  );
}

export function RenameWorkspaceForm({ name, slug }: { name: string; slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(renameWorkspaceAction, {});
  const [v, setV] = useState({ name, slug });
  const changed = v.name.trim() !== name || v.slug.trim().toLowerCase() !== slug;
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <label className="block">
        <span className="text-sm font-medium text-foreground">Edit Workspace Title</span>
        <span className="block text-xs text-muted-foreground">The name your team sees in the header and in invitation emails.</span>
        <input name="name" value={v.name} onChange={e => setV(p => ({ ...p, name: e.target.value }))} required maxLength={80} className="field mt-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Edit Workspace Slug</span>
        <span className="block text-xs text-muted-foreground">Unique identifier used in exports. Lowercase letters, numbers and hyphens.</span>
        <input name="slug" value={v.slug} onChange={e => setV(p => ({ ...p, slug: e.target.value.toLowerCase() }))} required minLength={3} maxLength={40} pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?" className="field mt-2 font-mono" />
      </label>
      <Submit label="Update" pendingLabel="Updating…" disabled={!changed || !v.name.trim()} />
    </form>
  );
}

export function RemoveWorkspace({ name, slug, blocker }: { name: string; slug: string; blocker: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(removeWorkspaceAction, {});
  const [typed, setTyped] = useState('');
  if (blocker) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className="btn-ghost cursor-not-allowed border-destructive/40 text-destructive opacity-50">Remove workspace</button>
        <p className="text-xs text-muted-foreground">{blocker}</p>
      </div>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="btn-ghost border-destructive/40 text-destructive hover:bg-destructive/10">Remove workspace</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the workspace with its members, invitations, favorites, brandtrackers, API keys and AI connections. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <Messages state={state} />
          <label className="block">
            <span className="text-sm text-foreground">Type <code className="font-mono font-semibold">{slug}</code> to confirm</span>
            <input name="confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" className="field mt-2 font-mono" />
          </label>
          <Submit label="Remove workspace" pendingLabel="Removing…" disabled={typed.trim() !== slug}
            className="btn w-full justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
