'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/auth/actions';

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function Field({ label, name, type = 'text', autoComplete, required = true, defaultValue, hint }: {
  label: string; name: string; type?: string; autoComplete?: string; required?: boolean; defaultValue?: string; hint?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <input
        name={name} type={type} autoComplete={autoComplete} required={required} defaultValue={defaultValue}
        className="field"
      />
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function AuthFormShell({
  action, children, submitLabel, pendingLabel,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode; submitLabel: string; pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="alert-error">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="alert-success">{state.ok}</p>
      )}
      {children}
      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}
