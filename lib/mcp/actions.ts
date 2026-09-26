'use server';
import { requireCtx, audit } from '@/lib/auth/guard';
import { revokeClient } from './oauth';

export async function revokeConnectionAction(clientId: string): Promise<void> {
  const ctx = await requireCtx();
  await revokeClient(ctx.workspaceId, clientId);
  await audit(ctx, 'oauth.revoked', clientId);
}
