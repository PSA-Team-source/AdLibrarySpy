import { notFound } from 'next/navigation';
import { getAd } from '@/lib/data';
import { requireCtx } from '@/lib/auth/guard';
import { AdDetail } from '@/components/market/AdDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const ad = await getAd((await params).id).catch(() => null);
  return { title: ad ? `${ad.advertiser} — ad` : 'Ad' };
}

/** Standalone ad page (shared links, reloads). The grid opens the same view as a drawer. */
export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const ad = await getAd(id);
  if (!ad) notFound();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <AdDetail ad={ad} workspaceId={ctx.workspaceId} userId={ctx.user.id} drawer={false} />
    </div>
  );
}
