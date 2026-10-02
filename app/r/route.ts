// GET /r?to=<same-site path>&c=<campaign>&u=<user id>&s=<signature>
// The click hop for links in our emails (lib/email/click.ts builds them): records
// `email_click` in dashboard.adlibraryspy_events, then 302s to the page. Never
// leaves the site: an unsafe `to` goes to /home. An unsigned or tampered link
// still redirects but records nothing, so counts are only real clicks by the
// user the email was sent to.
import { NextRequest, NextResponse } from 'next/server';
import { safePath, safeCampaign, verifiedClicker } from '@/lib/email/click';
import { emit } from '@/lib/analytics/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = safePath(sp.get('to'));
  const campaign = safeCampaign(sp.get('c'));
  if (to && campaign) {
    let user: string | null = null;
    try { user = verifiedClicker(sp.get('u'), campaign, to, sp.get('s')); } catch { /* no secret: redirect only */ }
    if (user) void emit('email_click', user, { ref: campaign, props: { to: to.slice(0, 300) } });
  }
  const res = NextResponse.redirect(new URL(to ?? '/home', process.env.APP_BASE_URL || req.nextUrl.origin), 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
