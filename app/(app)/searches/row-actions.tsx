'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bell, BellOff, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { deleteSearchAction, renameSearchAction, toggleSearchAlertAction } from './actions';

function Submit({ label, pending, className = 'btn-primary h-9 px-4' }: { label: string; pending: string; className?: string }) {
  const s = useFormStatus();
  return <button type="submit" disabled={s.pending} className={className}>{s.pending ? pending : label}</button>;
}

export function AlertToggle({ id, on }: { id: string; on: boolean }) {
  return (
    <form action={toggleSearchAlertAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="alert" value={on ? '0' : '1'} />
      <AlertSwitch on={on} />
    </form>
  );
}

function AlertSwitch({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-label="Email me new results"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[var(--primaryColor)]' : 'bg-muted'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {on ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
    </button>
  );
}

export function RenameSearch({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="tap-target rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Rename ${name}`} title="Rename">
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename search</DialogTitle>
        </DialogHeader>
        <form action={async f => { await renameSearchAction(f); setOpen(false); }} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <input name="name" required maxLength={80} defaultValue={name} className="field" autoFocus aria-label="Name" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><button type="button" className="btn-ghost h-9 px-4">Cancel</button></DialogClose>
            <Submit label="Save" pending="Saving…" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSearch({ id, name }: { id: string; name: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="tap-target rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label={`Delete ${name}`} title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>The saved filters and their alert are removed. Nothing else changes.</DialogDescription>
        </DialogHeader>
        <form action={deleteSearchAction} className="flex justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <DialogClose asChild><button type="button" className="btn-ghost h-9 px-4">Cancel</button></DialogClose>
          <Submit label="Delete" pending="Deleting…" className="btn h-9 bg-destructive px-4 text-destructive-foreground hover:opacity-90" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
