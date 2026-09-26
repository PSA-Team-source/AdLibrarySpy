/** Request header middleware.ts sets to the requested path + query (see loginUrl). */
export const PATH_HEADER = 'x-als-path';

/**
 * A post-auth redirect target taken from user input (?next=, form field).
 * Only same-origin absolute paths pass; everything else (//evil.com, /\evil.com,
 * https://…, control chars) is null so the caller falls back to /shops.
 */
export function safeNext(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 512) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}

/** The invitation token inside a safe `/invite?token=…` next, or null. */
export function inviteTokenFromNext(next: string | null): string | null {
  if (!next?.startsWith('/invite?')) return null;
  return new URLSearchParams(next.slice('/invite?'.length)).get('token') || null;
}

/** /login, carrying the page the visitor asked for so sign-in returns them there. */
export function loginUrl(path: string | null | undefined): string {
  const next = safeNext(path);
  return next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
