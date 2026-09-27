import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandLockup } from '@/components/brand/brand-mark';
import { RefBeacon } from '@/components/public/RefBeacon';
import { MetaPixel } from '@/components/public/MetaPixel';
import { OpenSourceAnnouncement } from '@/components/public/OpenSourceAnnouncement';
import { REPO_URL, SITE_URL } from '@/lib/public/site';

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

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <RefBeacon />
      <MetaPixel />
      <OpenSourceAnnouncement />
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-4 sm:px-7">
          <Link href="/" aria-label="AdLibrarySpy home" className="shrink-0 transition-opacity hover:opacity-80">
            <BrandLockup size={30} />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/login" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">Log in</Link>
            <Link href="/signup" className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap">
              Start free<ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
        {/* Phone: the two directory links stay reachable without a menu. */}
        <nav aria-label="Main navigation (mobile)" className="flex gap-5 border-t border-border px-4 py-2 md:hidden">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground hover:text-foreground">{n.label}</Link>
          ))}
          <Link href="/login" className="ml-auto text-sm text-muted-foreground hover:text-foreground sm:hidden">Log in</Link>
        </nav>
      </header>

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
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Create free account</Link>
            <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-foreground">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
