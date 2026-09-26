/**
 * Trust-boundary normaliser for GET /api/public/store?domain=.
 *
 * Accepts what a browser or a person pastes ("https://www.Shop.com/products/x?y",
 * "shop.com:443", an IDN) and returns the bare, lowercase, punycoded host the
 * market index keys stores by — or null when the input is not a public DNS
 * name. Only a value that passes here is ever sent on to the market API.
 * Pure (WHATWG URL only) so tests/public-store-domain.test.mjs can run it.
 */
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim().toLowerCase();
  if (!raw || raw.length > 2048) return null;
  let host: string;
  try {
    // Parsing through URL does IDN → punycode, strips port/path/query/userinfo.
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, '').replace(/^www\./, '');
  if (!host || host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every(l => LABEL.test(l))) return null;
  if (!TLD.test(labels[labels.length - 1])) return null;   // rejects IPv4 and numeric TLDs
  if (/(^|\.)(localhost|local|internal|invalid|test|example)$/.test(host)) return null;
  return host;
}
