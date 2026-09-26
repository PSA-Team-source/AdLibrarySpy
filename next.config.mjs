/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Type and lint errors fail the build. The previous config suppressed both,
  // which let broken types ship.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Client router cache, same recipe as PlatformDTC's dashboard: Next 15's default
  // `dynamic: 0` refetches every screen from us-east-1 on each click, even one the
  // user left a second ago. Every mutation purges this cache (server actions call
  // revalidatePath; Track/Untrack/Fav/Connections call router.refresh()).
  //   dynamic — screens reached by a plain click (dossiers, filtered lists).
  //   static  — screens warmed by AppShell's NavIdlePrefetch / hover (FULL prefetch).
  // ponytail: market data moves daily, so 5 min is invisible there; the one
  // ceiling is Home > Recents, which can lag a just-opened dossier by up to 5 min.
  experimental: { staleTimes: { dynamic: 180, static: 300 } },
  // Public pages (/store, /ad, /stores, /weekly) are edge-cached; this is the
  // stale-while-revalidate window Next writes into their Cache-Control, so a
  // cold POP serves the last copy while it refreshes instead of waiting on us.
  expireTime: 90000,
  images: {
    // Store logos and creatives come from arbitrary merchant CDNs, so the
    // optimizer cannot allowlist them; they are served as plain <img>.
    unoptimized: true,
  },
  // Public pricing remains disabled while checkout is not configured. The
  // authenticated billing page still shows truthful workspace and invoice data.
  async redirects() {
    return [
      { source: '/pricing', destination: '/signup', permanent: true },
    ];
  },
  async headers() {
    return [
      // Homepage media (public/landing): real product captures, re-captured
      // rarely — a day in the browser, a month at the Cloudflare edge.
      {
        source: '/landing/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=2592000' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};
export default nextConfig;
