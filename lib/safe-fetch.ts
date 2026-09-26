// Outbound fetch of third-party URLs (store domains and logos from the market
// index). Those values are not ours: a domain can point, or redirect, at
// 169.254.169.254 or a private service, so every hop is checked before it is
// requested and redirects are followed here, never by fetch.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const BLOCKED = new net.BlockList();
for (const [addr, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(addr, bits, 'ipv4');
for (const [addr, bits] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(addr, bits, 'ipv6');

/** URL.hostname keeps IPv6 literals bracketed ("[::1]"); net.isIP does not accept that. */
export function bareHost(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
}

/** Loopback per RFC 8252 §7.3 (native-app redirect URIs): localhost, 127/8, ::1. */
export function isLoopbackHost(hostname: string): boolean {
  const h = bareHost(hostname);
  if (h === 'localhost') return true;
  const v = net.isIP(h);
  return v === 4 ? h.startsWith('127.') : v === 6 && (h === '::1' || /^::ffff:127\./.test(h));
}

/** True for loopback, private, link-local, CGNAT, metadata, documentation and multicast addresses. */
export function isPrivateAddress(ip: string): boolean {
  const h = bareHost(ip);
  const v = net.isIP(h);
  if (!v) return true;                                 // not an address: refuse rather than guess
  return BLOCKED.check(h, v === 4 ? 'ipv4' : 'ipv6');
}

async function publicHost(hostname: string): Promise<boolean> {
  const h = bareHost(hostname);
  if (net.isIP(h)) return !isPrivateAddress(h);
  try {
    const addrs = await lookup(h, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every(a => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

export class BlockedUrlError extends Error {}

/**
 * fetch() for untrusted URLs: http(s) only, at most `maxRedirects` hops, each
 * hop's host must resolve only to public addresses. Next's `next: { revalidate }`
 * and the caller's signal pass through unchanged. Throws BlockedUrlError on a
 * refused hop (callers already treat a throw as "no data").
 * ponytail: the check resolves DNS separately from fetch's own connect, so a
 * host that re-binds between the two (TTL 0) can still slip through; closing
 * that needs a custom undici dispatcher with a checked lookup().
 */
export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new BlockedUrlError(`scheme ${current.protocol}`);
    if (current.username || current.password) throw new BlockedUrlError('credentials in URL');
    if (!(await publicHost(current.hostname))) throw new BlockedUrlError(`non-public host ${current.hostname}`);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) return res;
    if (hop >= maxRedirects) throw new BlockedUrlError('too many redirects');
    await res.body?.cancel().catch(() => {});
    current = new URL(location, current);
  }
}
