// IndexNow ownership key (https://www.indexnow.org/documentation): search
// engines fetch /<key>.txt to confirm submissions from scripts/indexnow.mjs
// come from this site. The key is public by design.
export const dynamic = 'force-static';
export function GET() {
  return new Response('bfc2b345b3d867338dd79061e7e54f93', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
