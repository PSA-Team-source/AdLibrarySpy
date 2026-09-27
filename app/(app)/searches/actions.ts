'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit, requireCtx } from '@/lib/auth/guard';
import { isSearchKind, MAX_SAVED_SEARCHES } from '@/lib/alerts/digest';
import { createSavedSearch, deleteSavedSearch, renameSavedSearch, setSavedSearchAlert } from '@/lib/saved-searches';

const Name = z.string().trim().min(1).max(80);
const Id = z.string().uuid();
const Query = z.string().max(2000);

export interface SaveSearchState { ok?: string; error?: string }

export async function saveSearchAction(_prev: SaveSearchState, form: FormData): Promise<SaveSearchState> {
  const ctx = await requireCtx();
  const kind = form.get('kind');
  const name = Name.safeParse(form.get('name'));
  const q = Query.safeParse(String(form.get('query') ?? ''));
  if (!isSearchKind(kind)) return { error: 'Unknown search type.' };
  if (!name.success) return { error: 'Give the search a name (up to 80 characters).' };
  if (!q.success) return { error: 'These filters are too long to save.' };
  const alert = form.get('alert') === 'on';
  const res = await createSavedSearch(ctx.workspaceId, ctx.user.id, kind, name.data, q.data, alert);
  if (!res.ok) {
    return res.error === 'exists'
      ? { error: `You already saved these filters as “${res.existingName}”.` }
      : { error: `You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Delete one first.` };
  }
  await audit(ctx, 'search.saved', name.data, { kind, alert });
  revalidatePath('/searches');
  return { ok: alert ? 'Saved. New results will be in your alert email.' : 'Saved.' };
}

export async function renameSearchAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const id = Id.safeParse(form.get('id'));
  const name = Name.safeParse(form.get('name'));
  if (!id.success || !name.success) return;
  if (await renameSavedSearch(ctx.workspaceId, ctx.user.id, id.data, name.data)) {
    await audit(ctx, 'search.renamed', name.data);
  }
  revalidatePath('/searches');
}

export async function toggleSearchAlertAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const id = Id.safeParse(form.get('id'));
  if (!id.success) return;
  const on = form.get('alert') === '1';
  if (await setSavedSearchAlert(ctx.workspaceId, ctx.user.id, id.data, on)) {
    await audit(ctx, on ? 'search.alert_on' : 'search.alert_off', id.data);
  }
  revalidatePath('/searches');
}

export async function deleteSearchAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const id = Id.safeParse(form.get('id'));
  if (!id.success) return;
  const name = await deleteSavedSearch(ctx.workspaceId, ctx.user.id, id.data);
  if (name) await audit(ctx, 'search.deleted', name);
  revalidatePath('/searches');
}
