import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ctxOrNull } from '@/lib/auth/guard';
import { recordView, VIEW_TYPES } from '@/lib/recents';
import { rateLimit } from '@/lib/ratelimit';
import { getAd, getShop } from '@/lib/data';

export const runtime = 'nodejs';

const Body = z.object({
  type: z.enum(VIEW_TYPES),
  id: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),
  label: z.string().max(200).default(''),
  image: z.string().max(1000).default(''),
});

/** Record that the signed-in user opened a dossier (app-shell route beacon or <RecordView>). */
export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  // A person opens a few dossiers a minute; this only stops a runaway script.
  const rl = await rateLimit(`views:${ctx.user.id}`, 120, 60);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  // The app shell's route beacon sends only type + id for shop and ad
  // dossiers; name and logo are resolved here from the same (cached) index
  // lookup the dossier itself just made. An id the index does not know is
  // not recorded — a Recents row must always open a real dossier.
  const v = parsed.data;
  if (!v.label && (v.type === 'shop' || v.type === 'ad')) {
    if (v.type === 'shop') {
      const shop = await getShop(v.id).catch(() => null);
      if (!shop) return NextResponse.json({ ok: false }, { status: 404 });
      v.label = shop.name; v.image = shop.logo;
    } else {
      const ad = await getAd(v.id).catch(() => null);
      if (!ad) return NextResponse.json({ ok: false }, { status: 404 });
      v.label = ad.advertiser; v.image = ad.storeLogo;
    }
  }
  await recordView(ctx.workspaceId, ctx.user.id, v);
  return NextResponse.json({ ok: true });
}
