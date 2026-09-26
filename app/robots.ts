import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/public/site';

// Public, indexable: /, /stores*, /store/*, /ad/*, /weekly*, /vs/*, /api/public/*.
// Everything behind a login (the (app) group), the auth screens and the rest of
// /api stay out of the crawl; their layouts also carry noindex.
const PRIVATE = [
  '/home', '/shops', '/ads', '/advertisers', '/brandtracker', '/trends',
  '/favorites', '/team', '/settings', '/connect',
  '/login', '/signup', '/forgot', '/reset', '/verify', '/invite', '/oauth',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/api/public/'], disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
