// Agent sign-in, step 2 (SKILL.md): the 6-digit code the user read from their
// email proves the address. Signs in (or creates the free account) and returns
// an API key named "AI agent" for /api/mcp. Same guess caps as the website
// (CODE_TRIES per code, 10/address and 30/IP per 15 minutes).
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { one, query } from '@/lib/db';
import { normalizeCode } from '@/lib/auth/code';
import { takeCode, createAccount } from '@/lib/auth/signin-core';
import { mintApiKey } from '@/lib/apikey-mint';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const bad = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
  const parsed = emailSchema.safeParse(body.email);
  if (!parsed.success) return bad(400, 'invalid_email', 'Send the same email address the code was sent to.');
  const email = parsed.data;
  const code = normalizeCode(body.code);
  if (!code) return bad(400, 'invalid_code', 'Ask the user for the 6-digit code from the email.');
  const ip = clientIp(req.headers);
  for (const [key, limit] of [[`code:${ip}`, 30], [`code:${email}`, 10]] as const) {
    if (!(await rateLimit(key, limit, 900)).allowed) return bad(429, 'rate_limited', 'Too many tries. Wait 15 minutes, then request a new code.');
  }

  const r = await takeCode(email, code);
  if (r.kind === 'none') return bad(400, 'code_expired', 'This code expired, was already used, or a newer one was sent. Request a new code.');
  if (r.kind === 'wrong') {
    return bad(400, 'code_wrong', r.left > 0
      ? `That code is not right. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`
      : 'That code is not right and is now void. Request a new code.');
  }

  const row = r.row;
  const user = await one<{ id: string }>('SELECT id FROM users WHERE email_norm = $1', [row.email]);
  let userId = user?.id;
  let created = false;
  if (userId) {
    await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [userId]);
  } else {
    userId = await createAccount({
      email: row.email, name: row.name, workspaceName: row.workspace_name,
      next: row.next, ref: row.ref, landing: row.landing, method: 'email_code',
    });
    created = true;
  }
  // The workspace the app opens: the oldest membership.
  const ws = await one<{ workspace_id: string }>(
    'SELECT workspace_id FROM workspace_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1', [userId]);
  if (!ws) return bad(500, 'no_workspace', 'This account has no workspace. Sign in at https://adlibraryspy.com once, then try again.');
  const key = await mintApiKey(ws.workspace_id, userId, 'AI agent');
  return NextResponse.json({
    ok: true,
    api_key: key,
    new_account: created,
    message: 'Signed in. Send this key as "Authorization: Bearer <api_key>" to https://adlibraryspy.com/api/mcp. Keep it for this conversation; never show it to anyone else. The user can revoke it at https://adlibraryspy.com/settings/api.',
  });
}
