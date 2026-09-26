'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createApiKeyAction, revokeApiKeyAction, type KeyState } from '@/lib/apikeys';

function Submit({ label, pendingLabel, className = 'btn-primary' }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>{pending ? pendingLabel : label}</button>;
}

export function CreateKeyForm() {
  const [state, action] = useActionState<KeyState, FormData>(createApiKeyAction, {});
  return (
    <div className="space-y-3">
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}

      {state.created && (
        <div role="status" className="alert-success py-3">
          <p className="font-medium">Copy this key now — it is not shown again.</p>
          <code className="mt-2 block break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground">{state.created}</code>
        </div>
      )}

      <form action={action} className="flex flex-wrap gap-2">
        <input
          name="name" placeholder="Key name (e.g. Production)" aria-label="Key name"
          className="field min-w-[200px] flex-1"
        />
        <Submit label="Create API key" pendingLabel="Creating…" />
      </form>
    </div>
  );
}

export function RevokeKeyButton({ id }: { id: string }) {
  const [, action] = useActionState<KeyState, FormData>(revokeApiKeyAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Submit label="Revoke" pendingLabel="Revoking…" className="btn-ghost h-8 px-3 text-xs hover:text-destructive" />
    </form>
  );
}
