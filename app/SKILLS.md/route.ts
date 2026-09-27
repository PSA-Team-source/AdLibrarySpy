// Common misspelling of /SKILL.md; one canonical URL for agents and caches. A
// relative Location: behind nginx the request URL's origin is the internal port.
export function GET() {
  return new Response(null, { status: 308, headers: { Location: '/SKILL.md', 'Cache-Control': 'public, max-age=86400' } });
}
