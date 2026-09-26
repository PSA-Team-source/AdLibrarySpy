'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revokeConnectionAction } from '@/lib/mcp/actions';

export function RevokeConnectionButton({ clientId, name }: { clientId: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await revokeConnectionAction(clientId); router.refresh(); })}
      className="btn-ghost h-8 px-3 text-xs hover:text-destructive disabled:opacity-60"
      title={`Revoke ${name}'s access`}
    >
      {pending ? 'Revoking…' : 'Revoke'}
    </button>
  );
}
