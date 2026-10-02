import { NextResponse, type NextRequest } from 'next/server';
import { REF_COOKIE, REF_MAX_AGE, firstTouchRef, fbcFromFbclid } from '@/lib/public/ref';
import { PATH_HEADER } from '@/lib/auth/safe-next';

/**
 * Three cheap jobs, no auth (pages do their own requireCtx):
 *  1. First-touch attribution: `?ref=` / `?utm_source=` → `als_ref` cookie, only when
 *     absent (contract + value format in lib/public/ref.ts) — on NON-public pages only
 *     (/signup?ref=…, /login?ref=…). Public pages never Set-Cookie: Cloudflare refuses to
 *     store a response that sets one, so every tagged launch link (`?ref=ph:launch`) used
 *     to BYPASS the edge and render at origin. There components/public/RefBeacon (in the
 *     public layout + homepage) sets the same cookie client-side, same rules, and signup
 *     (lib/auth/actions.ts) reads it from the request as before. A click that beats the
 *     landing page's hydration is caught here from the same-site Referer (firstTouchRef).
 *  2. Cache-Tag on the anonymous public surface, so a deploy can purge exactly those
 *     edge copies: `deploy/edge/deploy.sh --purge` purges this tag with the /shops one.
 *  3. The requested path rides along as the `x-als-path` REQUEST header so the auth
 *     guards (lib/auth/guard.ts) can send a signed-out visitor to /login?next=<path>
 *     and land them back on the page they asked for.
 */
const PUBLIC_CACHE_TAG = 'adlibraryspy-public-html';
const PUBLIC = /^\/$|^\/(store|ad|stores|trending|weekly|vs)(\/|$)|^\/api\/public\//;

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const isPublic = PUBLIC.test(pathname);
  // A tagged landing page's own ref (in the same-site Referer) beats the internal
  // link's (`?ref=home:hero`): the click can land here before RefBeacon ran there.
  const ref = isPublic || req.cookies.has(REF_COOKIE) ? null
    : firstTouchRef(pathname, searchParams, req.headers.get('referer'), req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  // Meta's click id for a tagged link opened straight on a non-public page (the
  // in-app browser's "open in browser" hand-off, components/GoogleSignIn): the
  // `_fbc` cookie RefBeacon writes on public pages (format in lib/public/ref.ts).
  const fbc = isPublic || req.cookies.has('_fbc') ? null : fbcFromFbclid(searchParams.get('fbclid'), Date.now());
  // Sessions older than the `als_in` hint (lib/auth/session.ts) get it on their next
  // app page, so the edge-cached homepage recognises them too. Never on public pages.
  const hint = !isPublic && req.cookies.has('ml_session') && !req.cookies.has('als_in');
  if (!isPublic && !ref && !fbc && !hint) return res;

  if (isPublic) res.headers.set('Cache-Tag', PUBLIC_CACHE_TAG);
  const secure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  if (hint) res.cookies.set('als_in', '1', { maxAge: 30 * 86400, path: '/', sameSite: 'lax', secure, httpOnly: false });
  if (fbc) res.cookies.set('_fbc', fbc, { maxAge: 60 * 60 * 24 * 90, path: '/', sameSite: 'lax', secure, httpOnly: false });
  if (ref) {
    res.cookies.set(REF_COOKIE, ref, {
      maxAge: REF_MAX_AGE, path: '/', sameSite: 'lax',
      secure,
      httpOnly: false,   // RefBeacon reads it to honour first-touch; holds no secret
    });
  }
  return res;
}

export const config = {
  matcher: [
    // Pages only: no /api (except the public JSON below), build assets, or static files.
    // Extensions are listed explicitly because /store/{domain} paths contain dots.
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|txt|xml|js|css|map|woff2?)$).*)',
    '/api/public/:path*',
  ],
};
