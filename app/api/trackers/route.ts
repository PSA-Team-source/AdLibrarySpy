import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ctxOrNull, audit } from '@/lib/auth/guard';
import { listTrackers, addTracker, removeTracker, trackerCount } from '@/lib/data';
import { one } from '@/lib/db';
import { captureSnapshot } from '@/lib/trackers';

export const runtime = 'nodejs';

const Body = z.object({
  action: z.enum(['add', 'remove']),
  shop: z.object({
    id: z.string().min(1).max(64),
    domain: z.string().min(3).max(253),
    name: z.string().max(200).default(''),
  }),
});

export async function GET() {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.json({ trackers: await listTrackers(ctx.workspaceId), limit: null });
}

export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { action, shop } = parsed.data;

  if (action === 'remove') {
    await removeTracker(ctx.workspaceId, shop.id);
    await audit(ctx, 'tracker.remove', shop.domain);
    return NextResponse.json({ tracked: false, count: await trackerCount(ctx.workspaceId) });
  }

  await addTracker(ctx.workspaceId, ctx.user.id, shop);
  await audit(ctx, 'tracker.add', shop.domain);
  // Record the first snapshot now, so the new row shows real figures at once
  // instead of waiting for the nightly cron. A tracker that already has one
  // (re-add) keeps its history; a failed capture is retried by the cron.
  const t = await one<{ id: string; has: boolean }>(
    `SELECT t.id, EXISTS (SELECT 1 FROM tracker_snapshots s WHERE s.tracker_id = t.id) AS has
       FROM trackers t WHERE t.workspace_id = $1 AND t.shop_id = $2`,
    [ctx.workspaceId, shop.id],
  );
  if (t && !t.has) await captureSnapshot(t.id, shop.id).catch(e => console.error('[trackers] first snapshot failed', e.message));
  return NextResponse.json({ tracked: true, count: await trackerCount(ctx.workspaceId) });
}
