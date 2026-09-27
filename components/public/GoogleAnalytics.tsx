import Script from 'next/script';

// GA4 measurement id, inlined at build time. Unset = no tag is rendered at all.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

// Client-side route changes are counted by GA4's enhanced measurement
// ("page changes based on browser history events", on by default), so one
// config call covers the App Router. The tag sets its cookies from JS, never a
// Set-Cookie response header, so public pages stay edge-cacheable.
export function GoogleAnalytics() {
  if (!GA_ID || !/^G-[A-Z0-9]+$/.test(GA_ID)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
