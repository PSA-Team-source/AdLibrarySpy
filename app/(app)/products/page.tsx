import { categoryTree } from '@/lib/market/shops';
import { requireCtx } from '@/lib/auth/guard';
import { ProductsExplorer } from '@/components/market/ProductsExplorer';
import { loadProducts, type ProductsPayload } from './load';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

// Renders the first page on the server so it paints with rows; every change
// after that is fetched by ProductsExplorer from /api/products (same loader).
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireCtx();
  const [cats, initial] = await Promise.all([
    categoryTree(),
    // The list is built in the background after an API restart; the explorer
    // shows the error with a retry instead of failing the whole route.
    loadProducts(sp).catch((err): ProductsPayload | null => { console.error('[products]', err); return null; }),
  ]);
  return <ProductsExplorer categories={cats} initial={initial} initialParams={sp} renderedAt={Date.now()} />;
}
