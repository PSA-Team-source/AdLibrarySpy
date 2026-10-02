import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLockup } from '@/components/brand/brand-mark';
import { SiteHeader } from '@/components/public/SiteHeader';
import { RefBeacon } from '@/components/public/RefBeacon';
import { MetaPixel } from '@/components/public/MetaPixel';
import { OpenSourceAnnouncement } from '@/components/public/OpenSourceAnnouncement';
import { REPO_URL, SITE_URL } from '@/lib/public/site';
import { sponsorUrl } from '@/lib/public/sponsor';

/**
 * Public (anonymous, indexable, edge-cached) chrome for /store, /ad, /stores, /weekly, /vs.
 * Same lockup + nav vocabulary as the marketing homepage (app/page.tsx), on the app's
 * light-default tokens so shop/ad content reuses the dashboard primitives.
 * NEVER read cookies()/headers()/session here: every visitor must get identical HTML
 * so Cloudflare can cache it (zone Cache Rule + Cache-Tag, see deploy/edge/deploy.sh).
 */

// Absolute canonical / og:image / twitter:image URLs for every public page.
export const metadata: Metadata = { metadataBase: new URL(SITE_URL) };

const NAV = [
  { href: '/stores', label: 'Shops directory' },
  { href: '/trending', label: 'Trending' },
  { href: '/weekly', label: 'Weekly' },
] as const;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const donateUrl = await sponsorUrl(REPO_URL);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <RefBeacon />
      <MetaPixel />
      <OpenSourceAnnouncement />
      <SiteHeader donateUrl={donateUrl} />

      <main className="mx-auto w-full min-w-0 max-w-[1180px] flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-8 text-center sm:px-7 md:flex-row md:items-center md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <Link href="/" aria-label="AdLibrarySpy home"><BrandLockup size={26} /></Link>
            <p className="text-xs text-muted-foreground">Free ecommerce intelligence grounded in real market data.</p>
            <p className="text-xs text-muted-foreground">Built by <a href="https://x.com/quantummaxing" target="_blank" rel="noopener" className="font-medium text-foreground hover:underline">@quantummaxing</a></p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {NAV.map(n => <Link key={n.href} href={n.href} className="hover:text-foreground">{n.label}</Link>)}
            <Link href="/login" className="signed-out-only hover:text-foreground">Log in</Link>
            <Link href="/signup" className="signed-out-only hover:text-foreground">Create free account</Link>
            <Link href="/shops" className="signed-in-only hover:text-foreground">Open app</Link>
            <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-foreground">GitHub</a>
            {donateUrl && <a href={donateUrl} target="_blank" rel="noopener" className="hover:text-foreground">Donate</a>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
