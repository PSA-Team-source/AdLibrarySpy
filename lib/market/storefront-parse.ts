// Parsers for a Shopify storefront's own HTML. Dependency-free so
// tests/storefront.test.mjs can import it under plain node.
const GRID = 12;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Shopify.theme = {...}; → schema_name. The merchant's own copy name ("resilia-old/main") is not a theme name. */
export function parseTheme(html: string): string {
  const m = html.match(/Shopify\.theme\s*=\s*(\{[^;]*?\})\s*;/);
  if (!m) return '';
  try { return str((JSON.parse(m[1]) as Record<string, unknown>).schema_name); } catch { return ''; }
}

export function parseLocale(html: string): string {
  return html.match(/Shopify\.locale\s*=\s*"([A-Za-z-]{2,10})"/)?.[1]
    ?? html.match(/<html[^>]*\slang="([A-Za-z-]{2,10})"/i)?.[1] ?? '';
}

/**
 * Product handles in the order a collection page renders them. Read from
 * <main> onward so header/menu links do not jump the queue.
 */
export function parseHandles(html: string, max = GRID): string[] {
  const start = html.search(/<main[\s>]/i);
  const body = start >= 0 ? html.slice(start) : html;
  const out: string[] = [];
  for (const m of body.matchAll(/href="[^"]*\/products\/([^"?#/]+)/g)) {
    const h = decodeURIComponent(m[1]).toLowerCase();
    if (!out.includes(h)) out.push(h);
    if (out.length >= max) break;
  }
  return out;
}
