// Weekly newsletter unsubscribe.
//
//   GET  ?u=<user id>&t=<signed token>  — the link in the mail footer. Shows a
//        one-button confirmation instead of acting, because mail scanners
//        prefetch GET links and would otherwise unsubscribe people silently.
//   POST ?u=&t=                          — the button above, and RFC 8058
//        one-click (List-Unsubscribe-Post: List-Unsubscribe=One-Click) from
//        Gmail/Yahoo/Apple Mail. Unsubscribes immediately, no session needed.
//
// The token is an HMAC of the user id (lib/weekly/unsubscribe.ts), so a link
// can only ever unsubscribe the person it was mailed to.
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyUnsubscribe } from '@/lib/weekly/unsubscribe';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · AdLibrarySpy</title>
<style>
:root{color-scheme:light dark;--bg:#f9fafb;--card:#fff;--fg:#111827;--muted:#6b7280;--line:#e5e7eb;--accent:#4338ca}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0f;--card:#15151b;--fg:#f3f4f6;--muted:#9ca3af;--line:#27272f;--accent:#818cf8}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:440px;margin:12vh auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px}
h1{font-size:19px;margin:0 0 8px}p{color:var(--muted);margin:0 0 18px}
button,a.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:8px;padding:10px 18px;font:600 14px inherit;text-decoration:none;cursor:pointer}
a{color:var(--accent)}
</style></head><body><main><div class="card">${body}</div></main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}

function params(req: NextRequest): { u: string; t: string } {
  const sp = req.nextUrl.searchParams;
  return { u: (sp.get('u') ?? '').trim().toLowerCase(), t: (sp.get('t') ?? '').trim() };
}

const invalid = () => page('Link not valid',
  `<h1>This link is not valid</h1><p>It may have been cut off by your mail app. You can turn the weekly report off any time in <a href="/settings/newsletter">Settings → Newsletter</a>.</p>`, 400);

export async function GET(req: NextRequest) {
  const { u, t } = params(req);
  if (!verifyUnsubscribe(u, t)) return invalid();
  const action = `/api/newsletter/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`;
  return page('Unsubscribe',
    `<h1>Stop the Monday report?</h1><p>You will no longer get the weekly AdLibrarySpy report by email. Your account is not affected.</p>
<form method="post" action="${esc(action)}"><button type="submit">Unsubscribe</button></form>`);
}

export async function POST(req: NextRequest) {
  const { u, t } = params(req);
  if (!verifyUnsubscribe(u, t)) return invalid();
  await query(
    `UPDATE newsletter_subscribers SET unsubscribed_at = now()
      WHERE user_id = $1 AND unsubscribed_at IS NULL`,
    [u],
  );
  // RFC 8058 clients POST `List-Unsubscribe=One-Click` and only read the status.
  const oneClick = (req.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')
    && (await req.text()).includes('List-Unsubscribe=One-Click');
  if (oneClick) return new NextResponse(null, { status: 200 });
  return page('Unsubscribed',
    `<h1>You are unsubscribed</h1><p>The weekly report will not be mailed to you again. Changed your mind? Turn it back on in <a href="/settings/newsletter">Settings → Newsletter</a>.</p>
<a class="btn" href="/weekly">Read this week's report</a>`);
}
