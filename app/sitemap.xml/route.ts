import { sitemapIndexXml } from '@/lib/seo/sitemap';

// The sitemap index: submit THIS url to Search Console. Static content, rebuilt daily.
export const revalidate = 86400;

export function GET() {
  return new Response(sitemapIndexXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
