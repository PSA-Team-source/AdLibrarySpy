import { categoryTree, techFacets } from '@/lib/market/shops';
import { requireCtx } from '@/lib/auth/guard';
import { ShopsExplorer } from '@/components/market/ShopsExplorer';
import { loadShops } from './load';
import { StartHere } from '@/components/home/StartHere';

export const metadata = { title: 'Shops' };
export const dynamic = 'force-dynamic';

// Renders the first page on the server so it paints with rows; every change
// after that is fetched by ShopsExplorer from /api/shops (same loader).
export default async function ShopsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  // "Start here" / "Picked for you" lives behind a bell in the header (no page height),
  // so it is offered on every view, not only the unfiltered first page.
  const [cats, tech, initial, intro] = await Promise.all([
    categoryTree(), techFacets(), loadShops(ctx, sp),
    // Called directly so an empty result (no live stores) leaves no wrapper behind.
    StartHere({ bell: true }).catch(e => { console.error('[start-here]', e); return null; }),
  ]);

  return (
    <ShopsExplorer
      categories={cats}
      tech={tech}
      initial={initial}
      initialParams={sp}
      renderedAt={Date.now()}
      intro={intro}
    />
  );
}
