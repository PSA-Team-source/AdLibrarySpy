// Outbound fetch of third-party URLs (store domains and logos from the market
// index). Those values are not ours: a domain can point, or redirect, at
// 169.254.169.254 or a private service, so every hop is checked before it is
// requested and redirects are followed here, never by fetch.
import { lookup } from 'node:dns/promises';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net, { type LookupFunction } from 'node:net';

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

export interface SafeGetResult { status: number; text: string }

/**
 * GET an untrusted URL over node:http(s) rather than fetch(). Shopify's bot
 * defence answers fetch()'s (undici's) connection from the production host with
 * a 429 "Verifying your connection..." page on every storefront, while node's
 * https client from the same box gets the JSON (measured 2026-09-27: goda.co,
 * allbirds.com, hoooyi.com). Storefront reads use this.
 *
 * Every address a hop connects to is checked inside the socket's own DNS lookup,
 * so a host cannot re-bind to a private address between check and connect.
 * Redirects are followed here (same checks), the body is capped at `maxBytes`
 * and the whole exchange at `timeoutMs`. Throws on a refused hop, a timeout or
 * an oversized body.
 */
export async function safeGet(url: string, opts: {
  headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number; maxRedirects?: number;
} = {}): Promise<SafeGetResult> {
  const deadline = Date.now() + (opts.timeoutMs ?? 6000);
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new BlockedUrlError(`scheme ${current.protocol}`);
    if (current.username || current.password) throw new BlockedUrlError('credentials in URL');
    const literal = bareHost(current.hostname);
    if (net.isIP(literal) && isPrivateAddress(literal)) throw new BlockedUrlError(`non-public host ${current.hostname}`);
    const res = await getOnce(current, opts.headers ?? {}, deadline, opts.maxBytes ?? 8_000_000);
    if (!res.location) return { status: res.status, text: res.text };
    if (hop >= maxRedirects) throw new BlockedUrlError('too many redirects');
    current = new URL(res.location, current);
  }
}

const checkedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (err, addrs) => {
    const list = (addrs ?? []) as unknown as LookupAddress[];
    if (err) return callback(err, '', 4);
    if (!list.length || list.some(a => isPrivateAddress(a.address))) {
      return callback(new BlockedUrlError(`non-public host ${hostname}`), '', 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function getOnce(u: URL, headers: Record<string, string>, deadline: number, maxBytes: number):
  Promise<{ status: number; location: string | null; text: string }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error('timeout'));
    const req = (u.protocol === 'https:' ? https : http).get(u, { headers, lookup: checkedLookup }, res => {
      const status = res.statusCode ?? 0;
      const location = status >= 300 && status < 400 ? res.headers.location ?? null : null;
      if (location) { res.resume(); return resolve({ status, location, text: '' }); }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) { req.destroy(new Error('response too large')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status, location: null, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('timeout')), remaining);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
}
