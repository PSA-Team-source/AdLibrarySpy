import type { Shop } from '@/lib/types';

// Absolute origin for canonical URLs, Open Graph and JSON-LD on the public pages.
// APP_BASE_URL is the same variable lib/mail.ts and lib/mcp/oauth.ts use.
export const SITE_URL = (process.env.APP_BASE_URL || 'https://adlibraryspy.com').replace(/\/$/, '');

/** Bare host for a /store/{domain} path segment, or '' when it cannot be a domain. */
export function publicDomain(raw: string): string {
  let d = '';
  try { d = decodeURIComponent(raw); } catch { return ''; }
  d = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  // Hostname shape only (labels of a-z0-9-, a dotted TLD): junk never reaches the market API.
  return d.length <= 253 && /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/.test(d) ? d : '';
}

export const storePath = (domain: string) => `/store/${domain}`;
export const adPath = (id: string) => `/ad/${encodeURIComponent(id)}`;
/** Gated action → signup, landing on the signed-in screen afterwards. */
export const signupFor = (next: string) => `/signup?next=${encodeURIComponent(next)}`;

/**
 * Visits a public surface may show: SimilarWeb's measurement of this exact host only.
 * The index estimate is often the PARENT domain's traffic — wrong on a shared card.
 */
export function measuredVisits(shop: Shop): number {
  return shop.trafficSource === 'similarweb' && shop.monthlyVisits > 0 ? shop.monthlyVisits : 0;
}
