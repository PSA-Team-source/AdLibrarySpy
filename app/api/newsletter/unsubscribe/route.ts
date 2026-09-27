// One-click unsubscribe for the weekly newsletter and (with l=alerts) the
// alerts digest.
//
//   GET  ?u=<user id>&t=<signed token>[&l=alerts]  — the link in the mail footer. Shows a
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
import { verifyUnsubscribe, isMailList, type MailList } from '@/lib/weekly/unsubscribe';

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

function params(req: NextRequest): { u: string; t: string; l: MailList } {
  const sp = req.nextUrl.searchParams;
  const l = sp.get('l');
  return { u: (sp.get('u') ?? '').trim().toLowerCase(), t: (sp.get('t') ?? '').trim(), l: isMailList(l) ? l : 'newsletter' };
}

const COPY: Record<MailList, { settings: string; tab: string; ask: string; askBody: string; done: string; doneBody: string; cta: string }> = {
  newsletter: {
    settings: '/settings/newsletter', tab: 'Newsletter',
    ask: 'Stop the Monday report?', askBody: 'You will no longer get the weekly AdLibrarySpy report by email. Your account is not affected.',
    done: 'The weekly report will not be mailed to you again.', doneBody: 'Turn it back on', cta: `<a class="btn" href="/weekly">Read this week's report</a>`,
  },
  alerts: {
    settings: '/settings/notifications', tab: 'Notifications',
    ask: 'Stop alert emails?', askBody: 'You will no longer get Brandtracker and saved-search alerts by email. Your trackers and saved searches stay as they are.',
    done: 'Alert emails are off.', doneBody: 'Turn them back on', cta: '<a class="btn" href="/brandtracker">Open Brandtracker</a>',
  },
};

const invalid = (l: MailList) => page('Link not valid',
  `<h1>This link is not valid</h1><p>It may have been cut off by your mail app. You can turn these emails off any time in <a href="${COPY[l].settings}">Settings → ${COPY[l].tab}</a>.</p>`, 400);

export async function GET(req: NextRequest) {
  const { u, t, l } = params(req);
  if (!verifyUnsubscribe(u, t, l)) return invalid(l);
  const action = `/api/newsletter/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}${l === 'newsletter' ? '' : `&l=${l}`}`;
  return page('Unsubscribe',
    `<h1>${COPY[l].ask}</h1><p>${COPY[l].askBody}</p>
<form method="post" action="${esc(action)}"><button type="submit">Unsubscribe</button></form>`);
}

export async function POST(req: NextRequest) {
  const { u, t, l } = params(req);
  if (!verifyUnsubscribe(u, t, l)) return invalid(l);
  if (l === 'alerts') {
    await query(
      `INSERT INTO alert_prefs (user_id, frequency) VALUES ($1, 'off')
       ON CONFLICT (user_id) DO UPDATE SET frequency = 'off', updated_at = now()`,
      [u],
    );
  } else {
    await query(
      `UPDATE newsletter_subscribers SET unsubscribed_at = now()
        WHERE user_id = $1 AND unsubscribed_at IS NULL`,
      [u],
    );
  }
  // RFC 8058 clients POST `List-Unsubscribe=One-Click` and only read the status.
  const oneClick = (req.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')
    && (await req.text()).includes('List-Unsubscribe=One-Click');
  if (oneClick) return new NextResponse(null, { status: 200 });
  const c = COPY[l];
  return page('Unsubscribed',
    `<h1>You are unsubscribed</h1><p>${c.done} Changed your mind? ${c.doneBody} in <a href="${c.settings}">Settings → ${c.tab}</a>.</p>
${c.cta}`);
}
