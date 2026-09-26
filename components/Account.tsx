'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfileAction, signOutOtherDevicesAction, changeEmailAction, resendVerification, type AccountState } from '@/lib/account';

function Submit({ label, pendingLabel, disabled = false, block = false }: { label: string; pendingLabel: string; disabled?: boolean; block?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={`btn-primary disabled:cursor-not-allowed disabled:opacity-50 ${block ? 'w-full justify-center' : ''}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Messages({ state }: { state: AccountState }) {
  return (
    <>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p role="status" className="alert-success">{state.ok}</p>}
    </>
  );
}

const input = 'field';

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState<AccountState, FormData>(updateProfileAction, {});
  const [value, setValue] = useState(name);
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <label className="block">
        <span className="text-sm font-medium text-foreground">Full Name</span>
        <input name="name" value={value} onChange={e => setValue(e.target.value)} required maxLength={120} autoComplete="name" className={`mt-1 ${input}`} />
      </label>
      <Submit label="Save Name" pendingLabel="Saving…" block disabled={!value.trim() || value.trim() === name} />
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState<AccountState, FormData>(changeEmailAction, {});
  const [value, setValue] = useState(email);
  const changed = value.trim().toLowerCase() !== email.toLowerCase();
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <label className="block">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input name="email" type="email" value={value} onChange={e => setValue(e.target.value)} required autoComplete="email" className={`mt-1 ${input}`} />
        <span className="mt-1 block text-xs text-muted-foreground">You sign in with links sent to this address. To change it, approve from the link we send to your current address, then confirm from the new one.</span>
      </label>
      <Submit label="Update Email" pendingLabel="Sending…" block disabled={!changed} />
    </form>
  );
}

export function SignOutEverywhereForm() {
  const [state, action] = useActionState<AccountState, FormData>(signOutOtherDevicesAction, {});
  return (
    <form action={action} className="space-y-3">
      <Messages state={state} />
      <div>
        <p className="text-sm font-medium text-foreground">Signed-in devices</p>
        <p className="mt-1 text-xs text-muted-foreground">You sign in with a one-time email link — there is no password to leak. If you left a session open somewhere, sign it out here.</p>
      </div>
      <Submit label="Sign out all other devices" pendingLabel="Signing out…" block />
    </form>
  );
}

export function VerifyBanner({ email }: { email: string }) {
  const [state, action] = useActionState<AccountState, FormData>(() => resendVerification(), {});
  return (
    <div role="status" className="alert-warning space-y-2 px-4 py-3">
      <p>
        <b>Confirm your email.</b> We sent a link to {email}.
      </p>
      <Messages state={state} />
      <form action={action}>
        <button type="submit" className="text-sm font-medium underline underline-offset-2 hover:opacity-80">Resend the confirmation email</button>
      </form>
    </div>
  );
}
