import { NextRequest, NextResponse } from 'next/server';
import { ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { loadLandingPages } from '@/app/(app)/landing-pages/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One Landing pages explorer page as JSON; takes exactly the /landing-pages query string. */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.landingPages(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  try {
    const data = await loadLandingPages(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/landing-pages]', err);
    return NextResponse.json({ error: 'Landing pages could not be loaded' }, { status: 502 });
  }
}
