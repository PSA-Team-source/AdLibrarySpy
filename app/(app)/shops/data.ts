// Workspace state behind the Shops explorer: hidden shops, the viewer's viewed
// shops (recent_views, written by the dossier) and the workspace's trackers.
// Shop ids are 'shp_<store_id>'; the market filter takes bare store_ids.
import { query } from '@/lib/db';

/** Cap on any one list sent to the index as a terms clause. */
const LIST_CAP = 5000;

export const storeIdOf = (shopId: string) => (shopId.startsWith('shp_') ? shopId.slice(4) : shopId);

export async function hiddenShopIds(workspaceId: string): Promise<string[]> {
  const rows = await query<{ shop_id: string }>(
    `SELECT shop_id FROM hidden_shops WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT ${LIST_CAP}`,
    [workspaceId],
  );
  return rows.map(r => r.shop_id);
}

export async function viewedShopIds(workspaceId: string, userId: string): Promise<string[]> {
  const rows = await query<{ entity_id: string }>(
    `SELECT entity_id FROM recent_views
      WHERE workspace_id=$1 AND user_id=$2 AND entity_type='shop'
      ORDER BY viewed_at DESC LIMIT ${LIST_CAP}`,
    [workspaceId, userId],
  );
  return rows.map(r => r.entity_id);
}

export async function trackedShopIdList(workspaceId: string): Promise<string[]> {
  const rows = await query<{ shop_id: string }>(
    `SELECT shop_id FROM trackers WHERE workspace_id=$1 LIMIT ${LIST_CAP}`,
    [workspaceId],
  );
  return rows.map(r => r.shop_id);
}

export async function hideShop(
  workspaceId: string, userId: string, shop: { id: string; domain: string; name: string },
): Promise<void> {
  await query(
    `INSERT INTO hidden_shops (workspace_id, shop_id, domain, name, hidden_by) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workspace_id, shop_id) DO NOTHING`,
    [workspaceId, shop.id, shop.domain.slice(0, 253), shop.name.slice(0, 200), userId],
  );
}

export async function unhideShop(workspaceId: string, shopId: string): Promise<boolean> {
  const rows = await query(`DELETE FROM hidden_shops WHERE workspace_id=$1 AND shop_id=$2 RETURNING shop_id`, [workspaceId, shopId]);
  return rows.length > 0;
}
