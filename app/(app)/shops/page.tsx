import { categoryTree, techFacets } from '@/lib/market/shops';
import { requireCtx } from '@/lib/auth/guard';
import { ShopsExplorer } from '@/components/market/ShopsExplorer';
import { loadShops } from './load';

export const metadata = { title: 'Shops' };
export const dynamic = 'force-dynamic';

// Renders the first page on the server so it paints with rows; every change
// after that is fetched by ShopsExplorer from /api/shops (same loader).
export default async function ShopsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const [cats, tech, initial] = await Promise.all([categoryTree(), techFacets(), loadShops(ctx, sp)]);

  return (
    <ShopsExplorer
      categories={cats}
      tech={tech}
      initial={initial}
      initialParams={sp}
      renderedAt={Date.now()}
    />
  );
}
