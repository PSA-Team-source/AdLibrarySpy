// Tools that work with no account: the live storefront and AdLibrarySpy's
// public, edge-cached endpoints.
import { inspectStore, normaliseDomain } from 'shopify-inspect';
import { indexCard } from 'shopify-inspect/index-card';

const PUBLIC_API = 'https://adlibraryspy.com/api/public';

const domainArg = {
  type: 'string',
  description: 'Store domain or URL, e.g. "allbirds.com" or "https://www.gymshark.com/collections/new".',
};

export const LOCAL_TOOLS = [
  {
    name: 'inspect_store',
    title: 'Inspect a Shopify store',
    description: 'Read a Shopify store\'s own live storefront right now: store name, myshopify domain, theme, currency, locale, '
      + 'published product count, price range, best sellers and newest products in the store\'s own order, and the apps '
      + 'and tracking pixels its homepage loads. Only what the store publishes is returned; apps loaded later than the '
      + 'homepage are not seen, so an absent app is not proof it is missing. shopify=false means the site is not a Shopify storefront.',
    inputSchema: {
      type: 'object',
      properties: { domain: domainArg, limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Products per list (default 12).' } },
      required: ['domain'],
    },
    async handler({ domain, limit }) {
      return inspectStore(String(domain ?? ''), { limit });
    },
  },
  {
    name: 'lookup_store',
    title: 'Store traffic and ads',
    description: 'AdLibrarySpy\'s index card for a store: monthly visits with their source and month (SimilarWeb-measured '
      + 'where available, otherwise labelled as the index\'s estimate), month-over-month growth, monthly history, live Meta '
      + 'ad count, niche, apps and pixels, and a link to the full report. found=false when the store is not indexed yet. '
      + 'null fields were not measured; they are not zero.',
    inputSchema: { type: 'object', properties: { domain: domainArg }, required: ['domain'] },
    async handler({ domain }) {
      const d = normaliseDomain(String(domain ?? ''));
      if (!d) throw new Error(`Not a public store domain: ${domain}`);
      const card = await indexCard(d);
      return card ? { found: true, ...card } : { found: false, domain: d };
    },
  },
  {
    name: 'weekly_report',
    title: 'Weekly Shopify breakouts',
    description: 'The AdLibrarySpy weekly report: stores scaling ads, fastest-growing stores by measured traffic, ad-count '
      + 'peaks, newest stores, breakout niches and their products. Each section says which source and period its figure comes from.',
    inputSchema: {
      type: 'object',
      properties: { week: { type: 'string', pattern: '^\\d{4}-w\\d{2}$', description: 'ISO week like "2026-w39". Omit for the latest.' } },
    },
    async handler({ week }) {
      const url = `${PUBLIC_API}/weekly${week ? `?week=${encodeURIComponent(week)}` : ''}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
      if (res.status === 404) return { found: false, week: week ?? null };
      if (!res.ok) throw new Error(`AdLibrarySpy answered HTTP ${res.status}`);
      return { found: true, ...(await res.json()) };
    },
  },
];
