import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Privacy policy for the AdLibrarySpy Chrome extension — the URL the Chrome
 * Web Store listing points to. Every statement is backed by the shipped code:
 * extension/manifest.json (activeTab + scripting, host adlibraryspy.com only),
 * extension/popup.js (one GET per popup open, no storage, no cookies sent) and
 * app/api/public/store/route.ts (anonymous, rate-limited per IP). Change the
 * code and this page together.
 */
export const dynamic = 'force-static';

const UPDATED = '25 September 2026';
const TITLE = 'AdLibrarySpy Chrome extension privacy policy';
const DESCRIPTION = 'What the free AdLibrarySpy Chrome extension reads, what it sends (only the hostname of the tab you inspect), and what it never collects.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy/extension' },
  openGraph: { type: 'article', url: '/privacy/extension', title: TITLE, description: DESCRIPTION, siteName: 'AdLibrarySpy' },
};

const H2 = 'mt-10 text-lg font-semibold tracking-[-0.01em] text-foreground';
const P = 'mt-3 text-[15px] leading-7 text-foreground/85';
const LI = 'text-[15px] leading-7 text-foreground/85';

export default function ExtensionPrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-[760px] px-4 py-12 sm:px-7 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">Chrome extension privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p className={P}>
        The AdLibrarySpy extension shows AdLibrarySpy&rsquo;s public market data (traffic, Meta ads, top products,
        apps) for the online store you are looking at. It is free and does not need an account. This page explains
        exactly what it reads and sends.
      </p>

      <h2 className={H2}>When it runs</h2>
      <p className={P}>
        Only when you click the AdLibrarySpy icon in your toolbar. It has no background process, does not run on
        pages you have not clicked it on, and does not watch your browsing.
      </p>

      <h2 className={H2}>What it reads on the page</h2>
      <p className={P}>
        When you click the icon, it checks the current tab once for signs that the site runs on Shopify (the
        storefront&rsquo;s <code>window.Shopify</code> object, Shopify meta tags, or files served from Shopify&rsquo;s
        CDN) and reads the page&rsquo;s hostname, for example <code>www.brand.com</code>, and the store&rsquo;s
        <code> myshopify.com</code> name if the page publishes one. It does not read page content, form fields,
        passwords, cookies, or anything you type.
      </p>

      <h2 className={H2}>What it sends</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li className={LI}>
          The store&rsquo;s hostname (and, if our index doesn&rsquo;t know that host, its <code>myshopify.com</code>
          name) to <code>https://adlibraryspy.com/api/public/store</code>, to look up that store.
        </li>
        <li className={LI}>Nothing else. No full URLs or page paths, no browsing history, no personal information.</li>
      </ul>
      <p className={P}>
        Like any web request, the lookup reaches our servers through Cloudflare with your IP address. We use the IP
        address only to rate-limit lookups (a per-IP counter in our database) and to protect the service from abuse.
        Lookups are anonymous: the extension sends no cookies or account identifiers with them, and the answer is the
        same public data for everyone.
      </p>

      <h2 className={H2}>What it stores</h2>
      <p className={P}>
        Nothing. The extension has no storage permission and keeps no history. Your browser may cache a store&rsquo;s
        answer for a few minutes, as it does for any web page.
      </p>

      <h2 className={H2}>What we never do</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li className={LI}>Sell or transfer data to third parties.</li>
        <li className={LI}>Use or transfer data for purposes unrelated to showing you store data.</li>
        <li className={LI}>Use or transfer data to determine creditworthiness or for lending.</li>
        <li className={LI}>Inject ads, change the pages you visit, or track you across sites.</li>
      </ul>

      <h2 className={H2}>Permissions, and why</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li className={LI}><strong>activeTab</strong>: lets the extension see the tab you clicked it on, and only that tab, only at that moment.</li>
        <li className={LI}><strong>scripting</strong>: runs the one-time Shopify check described above in that tab.</li>
        <li className={LI}><strong>adlibraryspy.com</strong>: the only site the extension talks to, to fetch store data.</li>
      </ul>

      <h2 className={H2}>Links you open</h2>
      <p className={P}>
        &ldquo;Open full analysis&rdquo; and &ldquo;Track this brand&rdquo; open adlibraryspy.com in a new tab with
        <code> ref=ext:chrome</code> in the address, so we can count visits that came from the extension. What happens
        on adlibraryspy.com, including creating an account, is covered by the website&rsquo;s own terms.
      </p>

      <h2 className={H2}>Changes</h2>
      <p className={P}>
        If the extension ever needs to read or send anything more, we will update this page and the Chrome Web Store
        listing before that version ships, and change the date above.
      </p>

      <p className="mt-12 text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-foreground hover:underline">AdLibrarySpy</Link> &middot; free shop and ad intelligence
      </p>
    </article>
  );
}
