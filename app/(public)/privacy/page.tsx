import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Privacy policy for adlibraryspy.com — also the "privacy policy link" on the
 * Google sign-in consent screen (Google Cloud project adlibraryspy-509814).
 * Every statement is backed by shipped code: lib/auth/* (sessions, magic links,
 * Google ID token), lib/migrations/* (what is stored), lib/ratelimit.ts,
 * lib/analytics/events.ts (first-party funnel events), components/public/RefBeacon
 * + middleware.ts (als_ref, _fbc), lib/analytics/meta-capi.ts (Conversions API).
 * Change the code and this page together.
 * privacy@adlibraryspy.com is a DTCMail alias (hosted on the DTCMail mail server).
 */
export const dynamic = 'force-static';

const UPDATED = '27 September 2026';
const CONTACT = 'privacy@adlibraryspy.com';
// Same switch as components/public/MetaPixel.tsx (build-inlined): the policy names
// the pixel exactly when the build loads it.
const META_PIXEL = /^\d{10,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? '');
// Same switch as lib/analytics/meta-capi.ts (read at build: this page is static).
const META_CAPI = META_PIXEL && !!process.env.META_CAPI_ACCESS_TOKEN?.trim();
// Same switch as components/public/GoogleAnalytics.tsx.
const GOOGLE_ANALYTICS = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '');
const TITLE = 'AdLibrarySpy privacy policy';
const DESCRIPTION = 'What adlibraryspy.com stores about you when you use it or sign in (with email or Google), why, who processes it, and how to have it deleted.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: { type: 'article', url: '/privacy', title: TITLE, description: DESCRIPTION, siteName: 'AdLibrarySpy' },
};

const H2 = 'mt-10 text-lg font-semibold tracking-[-0.01em] text-foreground';
const P = 'mt-3 text-[15px] leading-7 text-foreground/85';
const LI = 'text-[15px] leading-7 text-foreground/85';
const Mail = () => <a href={`mailto:${CONTACT}`} className="font-medium text-foreground underline">{CONTACT}</a>;

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-[760px] px-4 py-12 sm:px-7 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p className={P}>
        AdLibrarySpy (adlibraryspy.com) is a free shop and ad intelligence tool. This page explains what we store
        about you when you browse the site or use an account, why, and how to have it removed. The Chrome extension
        has <Link href="/privacy/extension" className="font-medium text-foreground underline">its own policy</Link>.
      </p>

      <h2 className={H2}>Browsing without an account</h2>
      <p className={P}>
        Public pages (shops, ads, the directory, the weekly report) need no account and set no cookies from our
        server. If you arrive through a tagged link (for example <code>?ref=</code> or <code>?utm_source=</code>),
        the page stores that tag in a first-party cookie, <code>als_ref</code>, for 30 days, so that if you sign up
        we know which link brought you. It holds only the tag, nothing about you.
      </p>
      {META_PIXEL && (
        <p className={P}>
          <strong>Meta pixel.</strong> To measure our own ads on Facebook and Instagram, pages load Meta&rsquo;s pixel,
          which reports each page view and, once, that a new account was created (with an internal account ID, never
          your email or name). Meta sets its own cookies to do this (<code>_fbp</code>, and <code>_fbc</code> when you
          arrive from one of our ads, which our page may also write so the ad click is not lost).
          {META_CAPI && <> When an account is created, our server also tells Meta directly (Meta&rsquo;s Conversions
          API), so the signup is counted even if the pixel was blocked or the sign-in link was opened on another device.
          It sends a one-way hash of your email address and of your account ID, those two Meta cookies, and the IP
          address and browser you signed up from, which Meta uses to match the signup to an ad click.</>}{' '}Its use is covered by{' '}
          <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener" className="font-medium text-foreground underline">Meta&rsquo;s privacy policy</a>.
        </p>
      )}
      {GOOGLE_ANALYTICS && (
        <p className={P}>
          <strong>Google Analytics.</strong> To see which pages are used and how visitors find us, pages load Google
          Analytics, which records page views, scrolls, outbound link clicks and site searches, with your browser,
          device and approximate location. It sets its own first-party cookies (<code>_ga</code>, <code>_ga_*</code>)
          from the page, never from our server; its use is covered by{' '}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" className="font-medium text-foreground underline">how Google uses information from sites that use its services</a>.
        </p>
      )}
      {META_PIXEL || GOOGLE_ANALYTICS ? (
        <p className={P}>
          Browser tracking protection or an ad blocker stops {META_PIXEL && GOOGLE_ANALYTICS ? 'these' : 'it'} without
          affecting the site. We use no other third-party analytics or advertising trackers.
        </p>
      ) : (
        <p className={P}>We use no third-party analytics, advertising pixels or cross-site trackers.</p>
      )}

      <h2 className={H2}>Your account</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li className={LI}><strong>Email address and name</strong>, to sign you in, show you in your workspace and send you account email.</li>
        <li className={LI}><strong>Workspace name</strong>, members, their roles and pending invitations.</li>
        <li className={LI}><strong>What you save in the app</strong>: favorites and folders, tracked brands, hidden shops, recently viewed items, and API keys (stored only as a hash).</li>
        <li className={LI}><strong>An activity log</strong> of changes made in your workspace, with the IP address they came from, which workspace owners can see.</li>
        <li className={LI}><strong>How you found us</strong>: the <code>als_ref</code> tag above and the page you signed up from{META_PIXEL && <>, and Meta&rsquo;s <code>_fbc</code>/<code>_fbp</code> ids when present, which identify the ad click</>}.</li>
      </ul>

      <h2 className={H2}>Signing in</h2>
      <p className={P}>
        <strong>Email link.</strong> We email you a one-time link that expires after 20 minutes. We store the address
        it was sent to, a hash of the link (never the link itself), and the IP address and browser that asked for it.
      </p>
      <p className={P}>
        <strong>Sign in with Google.</strong> If you choose it, Google sends us a signed token confirming your Google
        account ID, your email address (only if Google has verified it) and your name. We check the token with Google
        and keep your Google account ID so the same Google account always signs into the same AdLibrarySpy account. We
        receive nothing else from your Google account: no password, contacts, files, mail or calendar, and we get no
        ongoing access to it. Google&rsquo;s handling of your sign-in is covered by{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" className="font-medium text-foreground underline">Google&rsquo;s privacy policy</a>.
      </p>
      <p className={P}>
        <strong>Sessions.</strong> Once you are signed in, a cookie named <code>ml_session</code> keeps you signed in
        for up to 30 days. It is HTTP-only (page scripts cannot read it) and holds a random token; we store only its
        hash, together with the IP address and browser name of that sign-in, so a session can be revoked at once.
        A second cookie, <code>als_in</code>, only tells our pages that this browser is signed in (so the homepage
        does not offer Google sign-in again); it grants no access. Signing out removes both.
      </p>

      <h2 className={H2}>Email we send</h2>
      <p className={P}>
        Sign-in links, invitations you or your team send, and confirmations when you change your address. The weekly
        report is sent only if you subscribe, and every issue has an unsubscribe link. We send from our own mail
        servers and never give your address to anyone else.
      </p>

      <h2 className={H2}>Security and abuse protection</h2>
      <p className={P}>
        To stop abuse we count requests per IP address, and sign-in attempts per IP address and per email address,
        in short-lived counters. Our own product metrics record a few milestones per account (signed up, first save,
        first tracked brand, invitation sent or accepted) with your account and workspace IDs, in our own database.
      </p>

      <h2 className={H2}>Who processes it</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li className={LI}><strong>Amazon Web Services</strong> hosts the application and its database.</li>
        <li className={LI}><strong>Cloudflare</strong> delivers the site and sees each request, including your IP address, to serve and protect it.</li>
        <li className={LI}><strong>Google</strong>, when you choose Sign in with Google{GOOGLE_ANALYTICS && ', and through Google Analytics described above'}.</li>
        {META_PIXEL && <li className={LI}><strong>Meta</strong>, through the pixel{META_CAPI && ' and the signup report'} described above.</li>}
      </ul>
      <p className={P}>
        We do not sell your data, and we use it only to run AdLibrarySpy.
      </p>

      <h2 className={H2}>The data AdLibrarySpy shows</h2>
      <p className={P}>
        The shops, ads and traffic estimates in AdLibrarySpy describe businesses, drawn from public sources such as
        public storefronts and public ad libraries. If you believe a page shows personal information about you, write
        to <Mail /> and we will review it.
      </p>

      <h2 className={H2}>Keeping and deleting your data</h2>
      <p className={P}>
        We keep your account data while your account exists. Expired sign-in links and sessions stop working at once
        and are no longer used. To get a copy of your data, correct it, or delete your account and the personal data
        tied to it, email <Mail /> from the address on your account. We act on the request within 30 days. Workspace
        content you created for your team stays with the workspace unless you are its only member.
      </p>

      <h2 className={H2}>Changes</h2>
      <p className={P}>
        If we start collecting anything new, we will update this page before it happens and change the date above.
      </p>

      <h2 className={H2}>Contact</h2>
      <p className={P}>Questions or requests about your data: <Mail />.</p>

      <p className="mt-12 text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-foreground hover:underline">AdLibrarySpy</Link> &middot; free shop and ad intelligence
      </p>
    </article>
  );
}
