// XML for /sitemap.xml (a sitemap index) and /sitemaps/{file}.xml (its children).
//
// Route handlers rather than app/sitemap.ts + generateSitemaps: Next 15.5 injects
// generateStaticParams into that convention and PRERENDERS every child at build
// (even with dynamic = 'force-dynamic'), which would walk 1,000 index pages on
// every deploy and serve a copy frozen at build. These render on request; the
// expensive reads are unstable_cache'd for a day in lib/seo/directory.ts.
import { SITE_URL } from '@/lib/public/site';
import {
  countryDirectory, nicheDirectory, safe, sitemapDomains, techDirectory, STORE_SITEMAPS,
} from './directory';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const SITEMAP_FILES = ['pages', ...Array.from({ length: STORE_SITEMAPS }, (_, i) => `stores-${i + 1}`)];
export const sitemapUrl = (file: string) => `${SITE_URL}/sitemaps/${file}.xml`;

export function sitemapIndexXml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + SITEMAP_FILES.map(f => `<sitemap><loc>${esc(sitemapUrl(f))}</loc></sitemap>`).join('\n')
    + '\n</sitemapindex>\n';
}

type Entry = { path: string; priority: number; freq: 'daily' | 'weekly' };

function urlsetXml(entries: Entry[]): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.map(e => `<url><loc>${esc(SITE_URL + e.path)}</loc><changefreq>${e.freq}</changefreq><priority>${e.priority.toFixed(1)}</priority></url>`).join('\n')
    + '\n</urlset>\n';
}

/** Child sitemap by file name, or null for an unknown name (404). Throws when the data read failed. */
export async function sitemapFileXml(file: string): Promise<string | null> {
  if (file === 'pages') {
    const [niches, techs, countries] = await Promise.all([safe(nicheDirectory()), safe(techDirectory()), safe(countryDirectory())]);
    if (!niches.length && !techs.length && !countries.length) throw new Error('sitemap pages: directories unavailable');
    return urlsetXml([
      { path: '/', priority: 1, freq: 'weekly' },
      { path: '/stores', priority: 0.9, freq: 'daily' },
      { path: '/stores/trending', priority: 0.8, freq: 'daily' },
      { path: '/stores/trending/ads', priority: 0.8, freq: 'daily' },
      { path: '/trending', priority: 0.9, freq: 'daily' },
      { path: '/weekly', priority: 0.8, freq: 'weekly' },
      { path: '/vs/trendtrack', priority: 0.7, freq: 'weekly' },
      ...niches.map(x => ({ path: `/stores/niche/${x.slug}`, priority: x.parent ? 0.6 : 0.7, freq: 'daily' as const })),
      ...techs.map(x => ({ path: `/stores/tech/${x.slug}`, priority: 0.6, freq: 'daily' as const })),
      ...countries.map(x => ({ path: `/stores/country/${x.cc}`, priority: 0.6, freq: 'daily' as const })),
    ]);
  }
  const m = /^stores-(\d+)$/.exec(file);
  const n = m ? Number(m[1]) : 0;
  if (!n || n > STORE_SITEMAPS) return null;
  const domains = await sitemapDomains(n - 1);
  return urlsetXml(domains.map(d => ({ path: `/store/${d}`, priority: 0.5, freq: 'weekly' })));
}
