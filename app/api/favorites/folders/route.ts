import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ctxOrNull } from '@/lib/auth/guard';
import { cleanFolderName, createFolder, deleteFolder, renameFolder } from '@/lib/favorite-folders';

export const runtime = 'nodejs';

const Create = z.object({ type: z.enum(['shop', 'ad']), name: z.string() });
const Rename = z.object({ id: z.string().uuid(), name: z.string() });
const Remove = z.object({ id: z.string().uuid() });

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const NAME_RULE = 'Folder names are 1–60 characters and cannot reuse a built-in name.';

export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return bad('Not signed in', 401);
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad('Invalid request');
  const name = cleanFolderName(parsed.data.name);
  if (!name) return bad(NAME_RULE);
  const folder = await createFolder(ctx.workspaceId, ctx.user.id, parsed.data.type, name);
  if (!folder) return bad('You already have a folder with that name.', 409);
  return NextResponse.json({ folder });
}

export async function PATCH(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return bad('Not signed in', 401);
  const parsed = Rename.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad('Invalid request');
  const name = cleanFolderName(parsed.data.name);
  if (!name) return bad(NAME_RULE);
  const ok = await renameFolder(ctx.workspaceId, ctx.user.id, parsed.data.id, name);
  if (!ok) return bad('Folder not found, or the name is already used.', 409);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return bad('Not signed in', 401);
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad('Invalid request');
  const ok = await deleteFolder(ctx.workspaceId, ctx.user.id, parsed.data.id);
  if (!ok) return bad('Folder not found', 404);
  return NextResponse.json({ ok: true });
}
