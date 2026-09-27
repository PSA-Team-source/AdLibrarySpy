// One-time sign-in codes: the 6 digits emailed next to the magic link, typed on
// the "check your email" screen so the visitor never leaves the browser they are
// in (the link opens in the mail app's browser, which loses a Facebook/Instagram
// in-app session). Pure: shared by lib/auth/actions.ts and tests/sign-in-code.test.mjs.
//
// A 6-digit code has 10^6 values, so it is only safe with hard caps: CODE_TRIES
// wrong guesses kill the code (actions.ts takeCode), and the per-email / per-IP
// limits there bound guesses across codes. Only an HMAC is stored: a plain hash
// of 10^6 values is reversed instantly from a database copy, the HMAC needs the
// server's SESSION_SECRET too.
import crypto from 'node:crypto';

export const CODE_LENGTH = 6;
/** Wrong guesses after which the code is void (the emailed link keeps working). */
export const CODE_TRIES = 5;

/** A uniformly random 6-digit code, leading zeros kept. */
export function newCode(): string {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/** What the visitor typed or pasted ("123 456", "123-456") → the digits, or null. */
export function normalizeCode(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length === CODE_LENGTH ? digits : null;
}

/** HMAC bound to the address, so a code is worthless for any other email. */
export function hashCode(email: string, code: string, secret = process.env.SESSION_SECRET): string {
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET is not set — cannot issue sign-in codes');
  return crypto.createHmac('sha256', secret).update(`signin-code\n${email.toLowerCase()}\n${code}`).digest('hex');
}
