import './globals.css';
import './base.css';
import './utilities.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/components/providers/query-provider';
import { SITE_URL } from '@/lib/public/site';
import { GoogleAnalytics } from '@/components/public/GoogleAnalytics';

// Same font wiring as PlatformDTC's dashboard: the CSS variable is what
// tailwind.config.ts resolves `font-sans` to.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  // Absolute base for every relative URL Next emits (og:image, canonical). Without
  // it Next falls back to http://localhost:<port> and link unfurls show no image.
  metadataBase: new URL(SITE_URL),
  title: { default: 'AdLibrarySpy', template: '%s — AdLibrarySpy' },
  description: 'Shopify store discovery, ad intelligence and brand tracking over a live market index.',
  // Indexing is decided per route group: (public) pages and the homepage are
  // indexable; (app) and (auth) set noindex in their own layouts.
};

// Theme + query + tooltip providers mirror PlatformDTC's AppProviders: light by default,
// class-based, one app-wide TooltipProvider (never wrap a page in its own).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={300}>
              {children}
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
