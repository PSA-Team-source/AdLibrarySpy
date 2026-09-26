import { sitemapFileXml } from '@/lib/seo/sitemap';

// /sitemaps/pages.xml and /sitemaps/stores-{1..4}.xml. Rendered on request (never
// at build); the data behind them is cached for a day, so a crawler hit is a cache read.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!file.endsWith('.xml')) return new Response('Not found', { status: 404 });
  try {
    const xml = await sitemapFileXml(file.slice(0, -4));
    if (xml == null) return new Response('Not found', { status: 404 });
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    // 503 + Retry-After: crawlers retry later instead of dropping the URLs.
    console.error('[sitemap]', file, err);
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '600' } });
  }
}
