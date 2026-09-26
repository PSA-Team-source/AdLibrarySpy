'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit, requireCtx } from '@/lib/auth/guard';
import { hideShop, unhideShop } from './data';

const Shop = z.object({
  id: z.string().regex(/^shp_[a-z0-9]{1,64}$/i),
  domain: z.string().max(253).default(''),
  name: z.string().max(200).default(''),
});

/** Hide a shop from the Shops explorer for the whole workspace. */
export async function hideShopAction(input: z.input<typeof Shop>): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const shop = Shop.safeParse(input);
  if (!shop.success) return { ok: false };
  await hideShop(ctx.workspaceId, ctx.user.id, shop.data);
  await audit(ctx, 'shop.hidden', shop.data.domain || shop.data.id);
  revalidatePath('/shops');
  return { ok: true };
}

export async function unhideShopAction(input: z.input<typeof Shop>): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const shop = Shop.safeParse(input);
  if (!shop.success) return { ok: false };
  if (await unhideShop(ctx.workspaceId, shop.data.id)) {
    await audit(ctx, 'shop.unhidden', shop.data.domain || shop.data.id);
  }
  revalidatePath('/shops');
  return { ok: true };
}
