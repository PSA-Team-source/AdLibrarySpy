'use client';
import { useActionState, useState, useTransition } from 'react';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import {
  inviteMemberAction, revokeInviteAction, changeRoleAction, removeMemberAction,
  type ActionState,
} from '@/lib/workspace';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function Submit({ label, pendingLabel, className = 'btn-primary' }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>{pending ? pendingLabel : label}</button>;
}

export function InviteForm() {
  const [state, action] = useActionState<ActionState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p role="status" className="alert-success">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          name="email" type="email" required placeholder="teammate@company.com" aria-label="Email address"
          className="field min-w-[220px] flex-1"
        />
        <select name="role" aria-label="Role" defaultValue="member"
          className="field w-auto">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Submit label="Send invitation" pendingLabel="Sending…" />
      </div>
      <p className="text-xs text-muted-foreground">
        Admins can invite people and manage billing. Members can use the app and share saved items.
      </p>
    </form>
  );
}

export function InviteUserDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="btn-primary h-9 gap-1.5 px-4 text-sm"><UserPlus className="h-4 w-4" />Invite User</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>They get an email link that is valid for 7 days.</DialogDescription>
        </DialogHeader>
        <InviteForm />
      </DialogContent>
    </Dialog>
  );
}

export function MemberRow({ index, member, canManage }: {
  index: number;
  member: { userId: string; name: string; email: string; role: string; joinedAt: string };
  canManage: boolean;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const run = (fn: typeof changeRoleAction, fields: Record<string, string>) => start(async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setState(await fn({}, fd));
  });
  const nextRole = member.role === 'admin' ? 'member' : 'admin';
  return (
    <TableRow aria-busy={pending || undefined}>
      <TableCell className="w-12 tabular-nums text-muted-foreground">{index}</TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{member.name || member.email}</div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
        {state.error && <div role="alert" className="mt-0.5 text-xs text-destructive">{state.error}</div>}
      </TableCell>
      <TableCell><Badge variant="secondary" className="capitalize">{member.role}</Badge></TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{member.joinedAt}</TableCell>
      <TableCell className="w-16 text-right">
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={pending} aria-label={`Actions for ${member.email}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => run(changeRoleAction, { userId: member.userId, role: nextRole })}>
                {nextRole === 'admin' ? 'Make admin' : 'Make member'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive"
                onSelect={() => { if (confirm(`Remove ${member.email} from this workspace?`)) run(removeMemberAction, { userId: member.userId }); }}>
                Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

export function InviteRow({ invite, canManage }: {
  invite: { id: string; email: string; role: string; expiresAt: string };
  canManage: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(revokeInviteAction, {});
  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-3 transition-colors hover:bg-muted">
      <span className="font-medium text-foreground">{invite.email}</span>
      <Badge variant="secondary" className="capitalize">{invite.role}</Badge>
      <span className="text-xs text-muted-foreground">expires {invite.expiresAt}</span>
      <span className="flex-1" />
      {state.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}
      {canManage && (
        <form action={action}>
          <input type="hidden" name="id" value={invite.id} />
          <Submit label="Revoke" pendingLabel="Revoking…" className="btn-ghost h-8 px-3 text-xs hover:text-destructive" />
        </form>
      )}
    </li>
  );
}
