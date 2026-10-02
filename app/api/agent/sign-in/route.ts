// Agent sign-in, step 1 (SKILL.md): the agent asks its user for an email and
// posts it here; we email a 6-digit code (same code as the website's sign-in,
// lib/auth/signin-core.ts). A new address gets its free account on step 2.
// Never says whether the address already has an account.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendLoginCode, LINK_MINUTES } from '@/lib/auth/signin-core';
import { mailConfigured } from '@/lib/mail';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = emailSchema.safeParse((body as { email?: unknown }).email);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_email', message: 'Ask the user for a valid email address.' }, { status: 400 });
  const email = parsed.data;
  const ip = clientIp(req.headers);
  for (const [key, limit] of [[`magic:${ip}`, 10], [`magic:${email}`, 5]] as const) {
    if (!(await rateLimit(key, limit, 900)).allowed) {
      return NextResponse.json({ error: 'rate_limited', message: 'Too many codes requested. Wait 15 minutes, then try again.' }, { status: 429 });
    }
  }
  if (!mailConfigured()) return NextResponse.json({ error: 'unavailable', message: 'Email sign-in is temporarily unavailable. Try again shortly.' }, { status: 503 });
  const sent = await sendLoginCode(email, { ip, ref: 'agent:skill', landing: '/SKILL.md' });
  if (!sent) return NextResponse.json({ error: 'mail_failed', message: 'The email could not be sent. Try again in a minute.' }, { status: 502 });
  return NextResponse.json({
    ok: true,
    message: `A 6-digit code was emailed to ${email}. Ask the user for it, then POST {"email","code"} to /api/agent/verify. It expires in ${LINK_MINUTES} minutes.`,
    expires_in_minutes: LINK_MINUTES,
  });
}
