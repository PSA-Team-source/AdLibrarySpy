import { notFound } from 'next/navigation';
import { getAd } from '@/lib/data';
import { requireCtx } from '@/lib/auth/guard';
import { AdDetail } from '@/components/market/AdDetail';
import { AdDrawerShell } from '@/components/market/AdClient';

export const dynamic = 'force-dynamic';

export default async function AdDrawer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const ad = await getAd(id);
  if (!ad) notFound();
  return (
    <AdDrawerShell>
      <AdDetail ad={ad} workspaceId={ctx.workspaceId} userId={ctx.user.id} drawer />
    </AdDrawerShell>
  );
}
