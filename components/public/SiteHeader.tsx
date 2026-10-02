import Link from 'next/link';
import { ArrowRight, Coffee } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { GitHubMark } from '@/components/public/OpenSourceAnnouncement';
import { REPO_URL } from '@/lib/public/site';

const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/stores', label: 'Shops directory' },
  { href: '/trending', label: 'Trending' },
  { href: '/weekly', label: 'Weekly report' },
  { href: '/vs/trendtrack', label: 'vs TrendTrack' },
] as const;

/** The one public header: homepage and every public page (/store, /stores, /ad, /weekly, ...). */
export function SiteHeader({ donateUrl }: { donateUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050807] font-sans text-white antialiased">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="AdLibrarySpy home">
          <BrandMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight">AdLibrarySpy</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-white/70 lg:flex">
          {NAV.map(n => <Link key={n.href} href={n.href} className="hover:text-white">{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2 whitespace-nowrap">
          {donateUrl && (
            <a href={donateUrl} target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:text-white lg:inline-flex">
              <Coffee className="h-4 w-4" aria-hidden /> Donate
            </a>
          )}
          <a href={REPO_URL} target="_blank" rel="noopener" aria-label="AdLibrarySpy on GitHub" className="hidden rounded-lg p-2 text-white/70 hover:text-white sm:block">
            <GitHubMark className="h-5 w-5" />
          </a>
          <Link href="/login" className="signed-out-only rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white">Log in</Link>
          <Link href="/signup" className="signed-out-only inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium hover:bg-white/10">
            Start free <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link href="/shops" className="signed-in-only inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium hover:bg-white/10">
            Open app <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
      {/* Phone: the directory links stay reachable without a menu. */}
      <nav aria-label="Main (mobile)" className="flex gap-5 whitespace-nowrap border-t border-white/10 px-4 py-2 text-sm text-white/70 sm:px-6 lg:hidden">
        {NAV.slice(1).map(n => <Link key={n.href} href={n.href} className={n.href === '/vs/trendtrack' ? 'hover:text-white max-sm:hidden' : 'hover:text-white'}>{n.label}</Link>)}
      </nav>
    </header>
  );
}
