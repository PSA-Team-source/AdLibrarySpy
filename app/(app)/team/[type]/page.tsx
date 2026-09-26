import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/auth/guard';
import { favoriteIds } from '@/lib/data';
import { PageShell } from '@/components/layouts/page-shell';
import { SavedItems, SAVED_PAGE_SIZE } from '@/components/market/SavedItems';
import { MarketPagination } from '@/components/market/MarketToolbar';

export const dynamic = 'force-dynamic';

const TYPES = {
  shops: { entity: 'shop', label: 'Shops' },
  ads: { entity: 'ad', label: 'Ads' },
} as const;
type Slug = keyof typeof TYPES;

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return { title: type in TYPES ? `Shared ${TYPES[type as Slug].label}` : 'Team' };
}

export default async function TeamPage({ params, searchParams }: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const [{ type }, sp] = await Promise.all([params, searchParams]);
  if (!(type in TYPES)) notFound();
  const { entity, label } = TYPES[type as Slug];
  const ctx = await requireCtx();

  // `shared: true` = everything saved by anyone in the workspace; the star
  // state on each item is still the viewer's own.
  const [ids, mine] = await Promise.all([
    favoriteIds(ctx.workspaceId, ctx.user.id, entity, true),
    favoriteIds(ctx.workspaceId, ctx.user.id, entity),
  ]);
  const page = Math.max(1, Number(sp.page) || 1);
  const pageEntries = ids.slice((page - 1) * SAVED_PAGE_SIZE, page * SAVED_PAGE_SIZE).map(id => ({ id }));

  const empty = (
    <p className="py-16 text-center text-sm text-muted-foreground">
      No shared {label.toLowerCase()} yet. {label} anyone in {ctx.workspaceName} saves show up here.
    </p>
  );

  return (
    <PageShell fullHeight={entity === 'shop' && ids.length > 0} title={`Shared ${label}`}
      titleAdornment={<span className="pill tabular-nums">{ids.length.toLocaleString()}</span>}>
      <SavedItems entity={entity} entries={pageEntries} saved={new Set(mine)} empty={empty} />
      {ids.length > SAVED_PAGE_SIZE && (
        <MarketPagination page={page} total={ids.length} limit={SAVED_PAGE_SIZE} />
      )}
    </PageShell>
  );
}
