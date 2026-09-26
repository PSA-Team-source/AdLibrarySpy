import { NextResponse, type NextRequest } from 'next/server';
import { REF_COOKIE, REF_MAX_AGE, refFromUrl } from '@/lib/public/ref';
import { PATH_HEADER } from '@/lib/auth/safe-next';

/**
 * Two cheap jobs, no auth (pages do their own requireCtx):
 *  1. First-touch attribution: `?ref=` / `?utm_source=` → `als_ref` cookie, only when
 *     absent (contract + value format in lib/public/ref.ts). Public pages are usually
 *     answered by the Cloudflare cache and never reach this, so components/public/RefBeacon
 *     sets the same cookie client-side. A response carrying Set-Cookie is never stored
 *     by Cloudflare, so the cookie cannot leak into a cached copy.
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
  const ref = req.cookies.has(REF_COOKIE) ? null : refFromUrl(pathname, searchParams);
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  if (!isPublic && !ref) return res;

  if (isPublic) res.headers.set('Cache-Tag', PUBLIC_CACHE_TAG);
  if (ref) {
    res.cookies.set(REF_COOKIE, ref, {
      maxAge: REF_MAX_AGE, path: '/', sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
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
