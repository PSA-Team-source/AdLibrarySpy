import { headers } from 'next/headers';
import { categoryTree } from '@/lib/market/shops';
import { requireCtx } from '@/lib/auth/guard';
import { LandingPagesExplorer } from '@/components/market/LandingPagesExplorer';
import { loadLandingPages, type LandingPagesPayload } from './load';

export const metadata = { title: 'Landing pages' };
export const dynamic = 'force-dynamic';

// First page renders on the server; every change after that is fetched by the
// explorer from /api/landing-pages (same loader).
export default async function LandingPagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireCtx();
  // A client-side click (RSC request that is not a prefetch) skips the rows: the
  // explorer already holds them in its query cache, so waiting ~1s on the API here
  // only froze the screen. Full loads and prefetches still render rows on the server.
  const h = await headers();
  const clientNav = h.get('rsc') === '1' && !h.get('next-router-prefetch');
  const [cats, initial] = await Promise.all([
    categoryTree(),
    clientNav ? null : loadLandingPages(sp).catch((err): LandingPagesPayload | null => { console.error('[landing-pages]', err); return null; }),
  ]);
  return <LandingPagesExplorer categories={cats} initial={initial} initialParams={sp} renderedAt={Date.now()} />;
}
