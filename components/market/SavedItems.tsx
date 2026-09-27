import type { ReactNode } from 'react';
import { getAds, getShops, type FavType } from '@/lib/data';
import type { FavoriteFolder } from '@/lib/favorite-folders';
import { CreativeCard } from './CreativeCard';
import { ShopExplorerTable } from './ShopExplorerTable';
import { shopRowSignals, applyRowSignals } from '@/lib/market/shop-signals';
import { MoveToFolder } from '@/components/FavoriteFolders';

export const SAVED_PAGE_SIZE = 24;

/**
 * Saved items rendered with the parent library's own components: shops as
 * Shops-table rows, ads as ad cards. Favorites passes
 * `folders` to add a per-item folder picker; Team shows the items only.
 *
 * Saved rows reference index entities that can disappear; each one is
 * resolved and the missing ones are dropped rather than rendered empty.
 */
export async function SavedItems({ entity, entries, saved, folders, empty }: {
  entity: FavType;
  entries: { id: string; folderId?: string | null }[];
  saved: Set<string>;
  folders?: FavoriteFolder[];
  empty: ReactNode;
}) {
  const folderOf = new Map(entries.map(e => [e.id, e.folderId ?? null]));
  const picker = (id: string) => folders && (
    <MoveToFolder entity={entity} id={id} folderId={folderOf.get(id) ?? null} folders={folders} />
  );
  const ids = entries.map(e => e.id);
  if (!ids.length) return <>{empty}</>;

  if (entity === 'shop') {
    const found = await getShops(ids).catch(() => []);
    if (!found.length) return <>{empty}</>;
    const signals = await shopRowSignals(found.map(s => s.storeId));
    const shops = found.map(s => applyRowSignals(s, signals.get(s.storeId)));
    return (
      <ShopExplorerTable shops={shops} saved={saved}
        infoSlot={folders?.length ? s => picker(s.id) : undefined} />
    );
  }

  const ads = await getAds(ids).catch(() => []);
  if (!ads.length) return <>{empty}</>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {ads.map(ad => (
        <div key={ad.id} className="flex flex-col gap-2">
          <CreativeCard ad={ad} saved={saved.has(ad.id)} />
          {picker(ad.id)}
        </div>
      ))}
    </div>
  );
}
