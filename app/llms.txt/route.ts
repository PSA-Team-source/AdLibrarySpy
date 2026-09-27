import { SITE_URL, REPO_URL } from '@/lib/public/site';
import { HOME_FAQS, SITE_DESCRIPTION } from '@/lib/public/faq';
import { countryDirectory, nicheDirectory, safe } from '@/lib/seo/directory';

// /llms.txt (llmstxt.org): the site map answer engines and AI assistants read
// first. Built from the same directories as /sitemaps/pages.xml, so every link
// here is a page that exists; the directory reads are cached for a day.
export const dynamic = 'force-dynamic';

export async function GET() {
  const [niches, countries] = await Promise.all([safe(nicheDirectory()), safe(countryDirectory())]);
  const link = (title: string, path: string, note = '') => `- [${title}](${SITE_URL}${path})${note ? `: ${note}` : ''}`;
  const body = [
    '# AdLibrarySpy',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Every traffic figure names its source and month (SimilarWeb-measured for the exact store host, or labelled as an index estimate). Missing data is left out, never estimated. Ads come from the Meta Ad Library (Facebook and Instagram); TikTok and Google ads are not covered. The whole product is free and MIT-licensed.',
    '',
    '## Public pages',
    link('Shopify store directory', '/stores', 'top stores ranked by measured monthly visits'),
    link('Trending stores', '/stores/trending', 'fastest-growing stores by measured traffic'),
    link('Stores with the most live ads', '/stores/trending/ads'),
    link('Trending products and ads', '/trending'),
    link('Weekly winning-stores report', '/weekly', 'scaling stores, traffic growth, ad peaks, newest winners'),
    link('AdLibrarySpy vs TrendTrack', '/vs/trendtrack', 'feature and data-source comparison'),
    `- Store dossier: ${SITE_URL}/store/{domain} (e.g. ${SITE_URL}/store/gymshark.com) with traffic history, live Meta ads, products, apps and pixels`,
    '',
    ...(niches.some(n => !n.parent) ? ['## Stores by niche', ...niches.filter(n => !n.parent).map(n => link(`${n.name} stores`, `/stores/niche/${n.slug}`)), ''] : []),
    ...(countries.length ? ['## Stores by country', ...countries.slice(0, 30).map(c => link(`${c.name} stores`, `/stores/country/${c.cc}`)), ''] : []),
    '## For AI assistants and developers',
    `- Agent skill: ${SITE_URL}/SKILL.md — step-by-step instructions any AI agent can follow (public JSON, hosted MCP, recipes, data rules)`,
    `- MCP server (hosted, OAuth): ${SITE_URL}/api/mcp — tools: search_shops, search_products, get_shop, find_similar_shops, search_ads, get_ad, creative_breakdown, lookup_store, inspect_store, weekly_report, brandtracker`,
    '- MCP server (local): `npx -y adlibraryspy-mcp`',
    `- Public store card JSON: ${SITE_URL}/api/public/store?domain={domain}`,
    `- Weekly report JSON: ${SITE_URL}/api/public/weekly`,
    `- Source code (MIT): ${REPO_URL}`,
    '',
    '## FAQ',
    ...HOME_FAQS.flatMap(([q, a]) => [`### ${q}`, a, '']),
  ].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
