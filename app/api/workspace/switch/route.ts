// Switch the active workspace: POST /api/workspace/switch (form fields to, next).
// Used by the header's workspace menu and by the invite screen, so someone who
// accepts an invitation lands in the team's workspace instead of their own.
// Membership is checked here AND again on every request by resolveCtx, so the
// cookie can only ever select a workspace the user already belongs to.
// POST + same-origin only: it changes which workspace every later action hits,
// so another site must not be able to flip it with a link or an <img>.
import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { isMember, WORKSPACE_COOKIE } from '@/lib/auth/guard';
import { safeNext } from '@/lib/auth/safe-next';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const base = process.env.APP_BASE_URL || url.origin;
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site ? site !== 'same-origin' : origin !== new URL(base).origin) {
    return new NextResponse('Cross-site request refused.', { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get('next')) ?? '/home';
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, base), 303);

  const to = String(form?.get('to') ?? '');
  const res = NextResponse.redirect(new URL(next, base), 303);
  res.headers.set('Cache-Control', 'no-store');
  if (await isMember(user.id, to)) {
    res.cookies.set(WORKSPACE_COOKIE, to, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 365 * 86400,
    });
  }
  return res;
}
