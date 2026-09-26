import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/auth/guard';
import { favoriteIds } from '@/lib/data';
import { favoritesIn, isFolderId, listFolders } from '@/lib/favorite-folders';
import { PageShell } from '@/components/layouts/page-shell';
import { FolderBar } from '@/components/FavoriteFolders';
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
  return { title: type in TYPES ? `Favorite ${TYPES[type as Slug].label}` : 'Favorites' };
}

export default async function FavoritesPage({ params, searchParams }: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const [{ type }, sp] = await Promise.all([params, searchParams]);
  if (!(type in TYPES)) notFound();
  const { entity, label } = TYPES[type as Slug];
  const ctx = await requireCtx();

  const { folders, all, unfiled } = await listFolders(ctx.workspaceId, ctx.user.id, entity);
  // An unknown or foreign folder id falls back to "All" instead of a 404.
  const scope = sp.folder === 'default' ? 'default'
    : isFolderId(sp.folder) && folders.some(f => f.id === sp.folder) ? sp.folder : 'all';
  const entries = await favoritesIn(ctx.workspaceId, ctx.user.id, entity, scope);
  const page = Math.max(1, Number(sp.page) || 1);
  const pageEntries = entries.slice((page - 1) * SAVED_PAGE_SIZE, page * SAVED_PAGE_SIZE);
  const saved = new Set(await favoriteIds(ctx.workspaceId, ctx.user.id, entity));

  const empty = (
    <p className="py-16 text-center text-sm text-muted-foreground">
      {scope === 'all'
        ? `No ${label.toLowerCase()} saved yet. Use the ☆ on any ${entity} to save it here.`
        : `This folder is empty.`}
    </p>
  );

  return (
    <PageShell fullHeight={entity === 'shop' && entries.length > 0} title={`Favorite ${label}`}
      titleAdornment={<span className="pill tabular-nums">{all.toLocaleString()}</span>}>
      <FolderBar slug={type} entity={entity} label={label} folders={folders} all={all} unfiled={unfiled} current={scope} />
      <SavedItems entity={entity} entries={pageEntries} saved={saved} folders={folders} empty={empty} />
      {entries.length > SAVED_PAGE_SIZE && (
        <MarketPagination page={page} total={entries.length} limit={SAVED_PAGE_SIZE} />
      )}
    </PageShell>
  );
}
