import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ctxOrNull } from '@/lib/auth/guard';
import { toggleFavorite, favoriteCount } from '@/lib/data';
import { moveFavorite } from '@/lib/favorite-folders';

export const runtime = 'nodejs';

const Body = z.object({
  type: z.enum(['shop', 'ad']),
  id: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { type, id } = parsed.data;
  const saved = await toggleFavorite(ctx.workspaceId, ctx.user.id, type, id);
  const count = await favoriteCount(ctx.workspaceId, ctx.user.id, type);
  return NextResponse.json({ saved, count });
}

const Move = z.object({
  type: z.enum(['shop', 'ad']),
  id: z.string().min(1).max(128),
  folderId: z.string().uuid().nullable(),
});

/** Move a saved item between folders; folderId null = Default Folder. */
export async function PATCH(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = Move.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { type, id, folderId } = parsed.data;
  const ok = await moveFavorite(ctx.workspaceId, ctx.user.id, type, id, folderId);
  if (!ok) return NextResponse.json({ error: 'Saved item or folder not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
