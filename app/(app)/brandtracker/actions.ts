'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit, requireCtx } from '@/lib/auth/guard';
import { createTrackerFolder, deleteTrackerFolder, moveTracker } from '@/lib/trackers';

const Name = z.string().trim().min(1).max(60);
const Id = z.string().uuid();

export async function createFolderAction(formData: FormData): Promise<void> {
  const ctx = await requireCtx();
  const name = Name.safeParse(formData.get('name'));
  if (!name.success) redirect('/brandtracker?folderError=name');
  const id = await createTrackerFolder(ctx.workspaceId, ctx.user.id, name.data);
  if (!id) redirect('/brandtracker?folderError=exists');
  await audit(ctx, 'tracker.folder_created', name.data);
  revalidatePath('/brandtracker');
  revalidatePath('/home');
  redirect(`/brandtracker?folder=${id}`);
}

export async function deleteFolderAction(formData: FormData): Promise<void> {
  const ctx = await requireCtx();
  const id = Id.safeParse(formData.get('folderId'));
  if (!id.success) return;
  if (await deleteTrackerFolder(ctx.workspaceId, id.data)) {
    await audit(ctx, 'tracker.folder_deleted', String(formData.get('name') ?? ''));
  }
  revalidatePath('/brandtracker');
  revalidatePath('/home');
  redirect('/brandtracker');
}

export async function moveTrackerAction(formData: FormData): Promise<void> {
  const ctx = await requireCtx();
  const tracker = Id.safeParse(formData.get('trackerId'));
  const rawFolder = String(formData.get('folderId') ?? '');
  const folder = rawFolder ? Id.safeParse(rawFolder) : null;
  if (!tracker.success || (folder && !folder.success)) return;
  const folderId = folder?.success ? folder.data : null;
  if (await moveTracker(ctx.workspaceId, tracker.data, folderId)) {
    await audit(ctx, 'tracker.moved', String(formData.get('domain') ?? ''), { folderId });
  }
  revalidatePath('/brandtracker');
  revalidatePath('/home');
}
