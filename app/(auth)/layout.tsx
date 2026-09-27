import Link from 'next/link';
import { Store } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { MetaPixel } from '@/components/public/MetaPixel';
import { countShops } from '@/lib/market/shops';
import type { Metadata } from 'next';

// Sign-in screens are not search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// PlatformDTC auth surface: page on `bg-background`, the form in a bordered
// `bg-card` panel (components/client/sign-in-dialog.tsx, app/login/magic-link).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Sign-in must never wait on the market index: a slow count drops its tile.
  const total = (p: Promise<{ total: number | null }>) =>
    Promise.race([p.then(r => r.total, () => null), new Promise<null>(r => setTimeout(() => r(null), 2500))]);
  // Headline only the store index size, the number that matters here.
  const shopsTotal = await total(countShops({ platform: 'all' }).then(total => ({ total })));
  // Only totals the index actually returned; a failed count drops its tile.
  const tiles = [
    { icon: Store, label: 'Shops', value: shopsTotal },
  ].filter((t): t is { icon: typeof Store; label: string; value: number } => typeof t.value === 'number' && t.value > 0);
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <MetaPixel />
      <div className="flex flex-col justify-center px-4 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center gap-2 transition-opacity hover:opacity-80">
            <BrandMark size={32} />
            <span className="text-lg font-semibold text-foreground">AdLibrarySpy</span>
          </Link>
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            {children}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy policy</Link>
          </p>
        </div>
      </div>
      <div className="hidden flex-col justify-center border-l border-border bg-[var(--surface)] px-12 lg:flex">
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">See what&apos;s working. Before everyone else.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Explore the live advertising and commerce index used to find winning creatives, shops and competitors.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {tiles.map(t => (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <t.icon className="h-5 w-5 text-[var(--primaryColor)]" aria-hidden />
                <div className="mt-3 text-2xl font-semibold tabular-nums">{t.value.toLocaleString('en-US')}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
