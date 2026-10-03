import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, Bot, CalendarDays, Check, Coffee, Eye, Filter, GitPullRequest, Globe, Layers3, Scale, Search, Share2, Store, Users } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { BrandLogo } from '@/components/market/BrandLogo';
import { ProductImage } from '@/components/ShopMedia';
import { SiteHeader } from '@/components/public/SiteHeader';
import { RefBeacon } from '@/components/public/RefBeacon';
import { MetaPixel } from '@/components/public/MetaPixel';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { EmailSignIn } from '@/components/EmailSignIn';
import { StickyStartBar } from '@/components/public/StickyStartBar';
import { googleClientId } from '@/lib/auth/actions';
import { marketGet, unwrapTotal } from '@/lib/market/client';
import { listAds } from '@/lib/market/creatives';
import { directoryList, measuredMonth } from '@/lib/seo/directory';
import { GitHubMark, OpenSourceAnnouncement } from '@/components/public/OpenSourceAnnouncement';
import { measuredVisits, storePath, adPath, REPO_URL, AGENT_MESSAGE } from '@/lib/public/site';
import { AgentCopyLine } from '@/components/public/AgentConnect';
import { sponsorUrl } from '@/lib/public/sponsor';
import { compact, flag } from '@/lib/format';
import { HOME_FAQS as faqs, SITE_DESCRIPTION, siteJsonLd } from '@/lib/public/faq';
import type { Ad, Shop } from '@/lib/types';

// Marketing page, same for every visitor (edge-cached: zone Cache Rule + Cache-Tag
// from middleware.ts; NEVER read cookies()/headers() here), refreshed hourly so
// the index counts, the top stores and the creative wall are live data.
// Structure follows the category leader's homepage (hero video -> sources ->
// feature sheet -> FAQ); every image is a real capture of the product
// (public/landing, captured from production by scripts/capture-landing.mjs) and every number below is
// read from the index at render time. Absent data = the element is absent.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'AdLibrarySpy — 100% free Shopify store and Meta ads intelligence, built for the community',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  // og:image / twitter:image come from app/opengraph-image.jpg (1200x630 JPEG).
  openGraph: { type: 'website', url: '/', siteName: 'AdLibrarySpy' },
};

const LIME = '#a7f45a';
/** Store niche (top-level category id) of the homepage creative wall: Health. */
const HOME_WALL_NICHE = '4078';

async function liveData() {
  // Only numbers that impress are headlined (owner, 2026-09-25): the store
  // index is; the viewable ads library is not yet, so it is not counted here.
  const [shops, top, creatives] = await Promise.all([
    marketGet('/top-brands?platform=all&page=1&limit=1', { revalidate: 3600, retries: 1 }).then(unwrapTotal).catch(() => null),
    directoryList({ kind: 'all' }, 1).then(r => r.items).catch(() => [] as Shop[]),
    // The demo wall shows one niche (owner's pick: Health) so it reads as a real search.
    listAds({ limit: 60, category: HOME_WALL_NICHE, storesOnly: true }).then(r => r.items).catch(() => [] as Ad[]),
  ]);
  // At most two tiles per advertiser, so one brand's campaign doesn't fill the wall.
  const perBrand = new Map<string, number>();
  const wall = creatives.filter(a => {
    if (!a.image || !a.advertiser) return false;
    const n = perBrand.get(a.advertiser) ?? 0;
    perBrand.set(a.advertiser, n + 1);
    return n < 2;
  }).slice(0, 12);
  return { shops, top: top.filter(s => measuredVisits(s) > 0).slice(0, 8), wall };
}


export default async function HomePage() {
  const [{ shops, top, wall }, donateUrl] = await Promise.all([liveData(), sponsorUrl(REPO_URL)]);
  const month = measuredMonth(top);
  const extensionUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL;
  const google = await googleClientId();

  return (
    <main className="lp-root min-h-screen bg-black font-sans text-white antialiased">
      {/* Served from the Cloudflare edge (zone Cache Rule), so a shared link's hit often never reaches middleware's als_ref. */}
      <RefBeacon />
      <MetaPixel />
      {google && <GoogleSignIn clientId={google} context="signup" landing="/" oneTapOnly />}
      {/* Organization + WebSite + SoftwareApplication + the FAQ below, one graph (answer engines quote FAQPage). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()).replace(/</g, '\\u003c') }} />

      <OpenSourceAnnouncement />

      <SiteHeader donateUrl={donateUrl} />

      {/* ---------- hero: Tesla-style full-bleed panel (product tour fills the screen,
          title top-centre, actions bottom-centre). Silent loop; phones get the 540p encode. ---------- */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden px-4 sm:px-6">
        {/* Real ad creatives from the library fill the screen; no wall data = plain black (never a placeholder). */}
        {wall.length >= 6 && (
          <ul aria-hidden className="lp-kenburns absolute -inset-[6%] -z-20 grid opacity-60 saturate-[.8] grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {[...wall, ...wall].slice(0, 24).map((ad, i) => (
              <li key={i} className="hidden overflow-hidden rounded-md has-[img]:block"><ProductImage src={ad.image} alt="" className="h-full w-full object-cover" /></li>
            ))}
          </ul>
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_45%,rgba(0,0,0,.25),rgba(0,0,0,.85)_75%),linear-gradient(180deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.2)_35%,rgba(0,0,0,.4)_60%,rgba(0,0,0,.95)_100%)]" />

        <div className="mx-auto mt-[11vh] max-w-4xl text-center">
          <h1 className="lp-rise text-balance text-[40px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            See what&apos;s winning in ecommerce
          </h1>
          <p className="lp-rise mt-3 text-pretty text-base text-white/80 sm:text-lg" style={{ ['--d' as string]: '150ms' }}>
            {shops != null ? `${compact(shops)} stores and their Meta ads. ` : 'Stores and their Meta ads. '}
            <span className="underline decoration-white/50 underline-offset-4">100% free</span>, for everyone.
          </p>
        </div>

        {/* The product, centre stage (Tesla puts the car here): a real production capture. */}
        {wall.length >= 6 ? <div className="flex-1" /> : (
          <div className="lp-rise mx-auto mt-10 flex w-full max-w-5xl flex-1 items-center [perspective:1600px]" style={{ ['--d' as string]: '250ms' }}>
          <img src="/landing/shops.webp" alt="AdLibrarySpy shops explorer: stores ranked by Meta ads with traffic, growth and top products" width={2000} height={1097} fetchPriority="high"
            className="lp-tilt w-full rounded-xl border border-white/10 shadow-[0_60px_160px_-40px_rgba(167,244,90,.35)]" />
        </div>
        )}

        {/* Sign up right here: email, then the 6-digit code, without leaving the page
            (an ad visitor in the Facebook/Instagram browser loses nothing to a page
            load or to the emailed link opening elsewhere). Same actions as /signup. */}
        <div className="mx-auto mb-[6vh] mt-10 w-full max-w-xl text-center">
          <div className="signed-in-only lp-rise flex flex-col justify-center gap-3 sm:flex-row" style={{ ['--d' as string]: '300ms' }}>
            <Link href="/shops" className="lp-btn lp-btn-primary">Go to your dashboard</Link>
            <Link href="/stores" className="lp-btn lp-btn-glass">Browse shops</Link>
          </div>
          <div id="start" className="signed-out-only lp-rise scroll-mt-24" style={{ ['--d' as string]: '300ms' }}>
            <EmailSignIn variant="hero" layout="inline" pendingLabel="Sending…" submitLabel="Start free">
              <input type="hidden" name="landing" value="/" />
              <input type="hidden" name="ref" value="home:hero" />
              <label className="block min-w-0 flex-1">
                <span className="sr-only">Work email</span>
                <input name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@company.com"
                  className="h-12 w-full rounded-[4px] border border-white/25 bg-black/40 px-4 text-base text-white backdrop-blur-md placeholder:text-white/55 focus:border-white focus:outline-none" />
              </label>
            </EmailSignIn>
            <p className="mt-3 text-xs text-white/65">No password, no card. We email you a 6-digit code. · <Link href="/stores" className="underline underline-offset-2 hover:text-white">Browse shops first</Link></p>
          </div>
          <div className="lp-rise mx-auto mt-8 w-full rounded-lg border border-white/15 bg-black/50 p-4 text-left backdrop-blur-xl" style={{ ['--d' as string]: '450ms' }}>
            <AgentCopyLine label="Or connect any AI: paste this into Claude, ChatGPT or Cursor" value={AGENT_MESSAGE} />
            <a href="#ai" className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white"><Bot className="h-3.5 w-3.5" aria-hidden /> How it works</a>
          </div>
          <a href="#tour" aria-label="Scroll down" className="lp-cue mx-auto mt-8 hidden w-fit text-white/70 sm:block">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
          </a>
        </div>
      </section>

      <div className="border-b border-white/10 px-4 py-6 sm:px-6">
        <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[13px] text-white/55">
          <li className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" aria-hidden />Meta Ad Library</li>
          <li className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" aria-hidden />SimilarWeb traffic</li>
          <li className="inline-flex items-center gap-2"><Store className="h-4 w-4" aria-hidden />Shopify storefront feeds</li>
          <li className="inline-flex items-center gap-2"><Globe className="h-4 w-4" aria-hidden />PlatformDTC market index</li>
          <li><a href="#ai" className="inline-flex items-center gap-2 hover:text-white"><Bot className="h-4 w-4" aria-hidden />Works in any AI agent</a></li>
        </ul>
      </div>

      {/* Product tour: motion design over real production crops and live numbers
          (scripts/fb-video-v2.mjs --set=home). Its own full-bleed panel: the video carries captions. */}
      <section id="tour" className="relative flex min-h-[100svh] items-center justify-center px-4 py-20 sm:px-6" aria-label="Product tour">
        <div className="lp-zoom w-full max-w-7xl overflow-hidden rounded-lg">
        <video className="block aspect-video w-full motion-reduce:hidden" autoPlay muted loop playsInline preload="metadata"
          poster="/landing/tour-20260927.webp" aria-label="AdLibrarySpy product tour: the live Meta ads library, the store behind an ad, its SimilarWeb traffic, its best sellers, its live ad count over time, and Brandtracker">
          <source src="/landing/tour-20260927-m.webm" type="video/webm" media="(max-width: 639px)" />
          <source src="/landing/tour-20260927-m.mp4" type="video/mp4" media="(max-width: 639px)" />
          <source src="/landing/tour-20260927.webm" type="video/webm" />
          <source src="/landing/tour-20260927.mp4" type="video/mp4" />
        </video>
        <img src="/landing/tour-20260927.webp" alt="AdLibrarySpy: spy on any Shopify store. Live Meta ads, SimilarWeb traffic, best sellers" width={1600} height={900} className="hidden aspect-video w-full motion-reduce:block" />
        </div>
      </section>

      {/* ---------- feature sheet ---------- */}
      <div id="features" className="text-white">
        <Feature kicker="Shops" title={<>Find the stores winning right now</>}
          body="Filter the whole index by platform, category, traffic, growth, country, apps and pixels. Every row shows measured visits and growth, AOV, live and peak Meta ads, and top products."
          cta={{ href: '/signup?ref=home:shops', label: 'Explore shops free' }}
          points={[[Filter, 'Platform, category, traffic, growth, country, tech & pixel filters'], [BarChart3, 'SimilarWeb visits for the exact store'], [Eye, 'Hide what you have already seen']]}>
          <Shot src="/landing/shops.webp" url="adlibraryspy.com/shops" alt="Shops explorer ranked by peak Meta ads, with platform and category filters, monthly traffic, growth, AOV and top products" />
        </Feature>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 pb-28 sm:px-6 lg:grid-cols-2">
          <Card title="Analyze any store" body="Traffic over time, visitor countries, live ads over time, products, apps and similar shops — in one dossier.">
            <Shot src="/landing/dossier.webp" url="adlibraryspy.com/shops/gymshark" alt="Gymshark shop dossier with traffic and live ads charts" />
          </Card>
          <Card title="Track your competitors" body="Add any store to Brandtracker. Snapshots record their traffic and ad activity, and an email tells you when they move, so you see changes, not re-run research.">
            <Shot src="/landing/brandtracker.webp" url="adlibraryspy.com/brandtracker" alt="Brandtracker list of tracked brands with traffic and live ads" />
          </Card>
        </div>

        {top.length > 0 && (
          <section className="border-y border-white/10 bg-[#070908] px-4 py-28 sm:px-6" aria-labelledby="top-stores">
            <div className="lp-reveal mx-auto max-w-6xl">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <Kicker>Live from the index</Kicker>
                  <h2 id="top-stores" className="mt-4 text-4xl font-medium tracking-[-0.035em] sm:text-6xl">Biggest Shopify stores this month</h2>
                  <p className="mt-3 text-sm text-white/50">Ranked by monthly visits measured by SimilarWeb{month ? ` (${month})` : ''}. Open any store — no account needed.</p>
                </div>
                <Link href="/stores" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Full directory <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
              <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {top.map((s, i) => (
                  <li key={s.id} className="min-w-0">
                    <Link href={storePath(s.domain)} className="flex h-full min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-500 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]">
                      <span className="w-5 text-sm tabular-nums text-white/35">{i + 1}</span>
                      <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{s.name}</span>
                        <span className="block truncate text-xs text-white/45">{s.domain}</span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-white/70">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden />{compact(measuredVisits(s))}</span>
                          {s.metaAds > 0 && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />{compact(s.metaAds)} ads</span>}
                          {s.country && <span aria-label={s.country}>{flag(s.country)}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <Feature kicker="Ads" title={<>The ads library for ecommerce</>}
          body="Search Meta ad creatives by brand, niche, format, placement and country. Open any ad for its copy, landing page, run dates and the brand's other ads."
          cta={{ href: '/signup?ref=home:ads', label: 'Explore ads free' }}
          points={[[Search, 'Search copy, brands and landing pages'], [CalendarDays, 'Run dates and placements per ad'], [Share2, 'Save to folders and share with your team']]}
          reverse>
          <Shot src="/landing/ads.webp" url="adlibraryspy.com/ads" alt="Ads library grid with real Meta ad creatives" />
        </Feature>

        {wall.length >= 6 && (
          <section className="px-4 pb-28 sm:px-6" aria-label="Health niche ad creatives from the library">
            <div className="mx-auto max-w-6xl">
              <ul className="lp-reveal grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                {wall.map(ad => (
                  <li key={ad.id} className="hidden has-[img]:block">
                    <Link href={adPath(ad.id)} className="group relative block overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                      <ProductImage src={ad.image} alt={`${ad.advertiser} ad`} className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
                      <span className="block truncate px-2.5 py-2 text-xs font-medium">{ad.advertiser}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <Feature kicker="Weekly report" title={<>What moved this week — every Monday</>}
          body="The stores adding the most ads, the fastest traffic growth, the biggest ad peaks and the newest winners — measured, sourced and public."
          cta={{ href: '/weekly', label: 'Read this week\'s report' }}
          points={[[BarChart3, 'Every figure with its source and period'], [Share2, 'Share any list in one click'], [Check, 'By email every Monday, opt-in']]}>
          <Shot src="/landing/weekly.webp" url="adlibraryspy.com/weekly" alt="The Monday report listing top scaling stores" />
        </Feature>

        <section className="px-4 pb-24 sm:px-6" aria-labelledby="ai">
          <div className="lp-reveal mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white sm:p-12 lg:grid-cols-2">
            <div>
              <Kicker dark>AI access</Kicker>
              <h2 id="ai" className="mt-4 text-4xl font-medium tracking-[-0.035em] sm:text-5xl">Ask your AI</h2>
              <p className="mt-3 text-white/65">Send your agent one message. Claude, ChatGPT, Cursor or any agent that can open a link reads our guide and starts researching stores and Meta ads for you. No sign-up form, no password, no key to copy.</p>
              <ol className="mt-6 space-y-2 text-sm text-white/75">
                <li className="flex gap-2"><span style={{ color: LIME }}>1.</span> Copy the message.</li>
                <li className="flex gap-2"><span style={{ color: LIME }}>2.</span> Paste it into your agent's chat.</li>
                <li className="flex gap-2"><span style={{ color: LIME }}>3.</span> For full search it asks for your email, then the 6-digit code we send you. That's it.</li>
                <li className="flex gap-2"><span style={{ color: LIME }}>4.</span> Ask about any store, product or ad.</li>
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href="/SKILL.md" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">
                  Read the guide your agent gets <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
            <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <AgentCopyLine label="Paste into any agent" value={AGENT_MESSAGE} />
              <AgentCopyLine label="Claude Code (one command)" value="claude mcp add --transport http adlibraryspy https://adlibraryspy.com/api/mcp" />
              <AgentCopyLine label="Claude app: Settings → Connectors → Add custom connector" value="https://adlibraryspy.com/api/mcp" />
            </div>
          </div>
        </section>
      </div>

      {/* ---------- open source ---------- */}
      <section className="px-4 pt-24 sm:px-6" aria-labelledby="oss">
        <div className="lp-reveal mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <Kicker dark>Open source</Kicker>
            <h2 id="oss" className="mt-4 text-4xl font-medium tracking-[-0.035em] sm:text-5xl">Built in the open. Help build it.</h2>
            <p className="mt-3 text-white/65">Every line of AdLibrarySpy is on GitHub under the MIT license: the web app, the Chrome extension, the MCP server and the CLI. Found a bug, want a filter, or have a data source we should add? Open an issue or send a pull request.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={REPO_URL} target="_blank" rel="noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-[#071004]" style={{ background: LIME }}>
                <GitHubMark className="h-4 w-4" /> Star on GitHub
              </a>
              <a href={`${REPO_URL}/contribute`} target="_blank" rel="noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-white/90 hover:bg-white/5">
                Find a first issue <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              {donateUrl && (
                <a href={donateUrl} target="_blank" rel="noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-white/90 hover:bg-white/5">
                  <Coffee className="h-4 w-4" aria-hidden /> Buy me a coffee
                </a>
              )}
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-sm">
            {([
              [Scale, 'MIT license', `${REPO_URL}/blob/main/LICENSE`],
              [GitPullRequest, 'Contributing guide', `${REPO_URL}/blob/main/CONTRIBUTING.md`],
              [Bot, 'MCP server & CLI packages', `${REPO_URL}/tree/main/packages`],
              [Globe, 'Chrome extension source', `${REPO_URL}/tree/main/extension`],
            ] as const).map(([Icon, label, href]) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 text-white/85 hover:bg-white/[0.07]">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: LIME }} aria-hidden />{label}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-white/40" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="px-4 py-24 sm:px-6">
        <div className="lp-reveal mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Kicker dark>FAQ</Kicker>
            <h2 className="mt-4 text-4xl font-medium tracking-[-0.035em] sm:text-5xl">Questions, answered</h2>
            <p className="mt-3 text-sm text-white/60">Comparing tools? Read the <Link href="/vs/trendtrack" className="underline">honest AdLibrarySpy vs TrendTrack breakdown</Link>.</p>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {faqs.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                  {q}<span className="text-white/50 transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="relative overflow-hidden px-4 pb-24 sm:px-6">
        <div className="lp-reveal relative mx-auto max-w-5xl px-6 py-20 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-40 blur-[90px]" style={{ background: `radial-gradient(closest-side, ${LIME}44, transparent)` }} />
          <h2 className="text-balance text-4xl font-medium tracking-[-0.045em] sm:text-7xl">Know what&apos;s working before everyone else</h2>
          <p className="mt-5 text-lg font-semibold">
            <span style={{ color: LIME }}>100% FREE</span> <span className="text-white/40" aria-hidden>·</span> Built for the Community
          </p>
          <p className="mt-2 text-white/65">Free for you and your whole team. No card, no trial, no limits to unlock.</p>
          <Link href="/signup?ref=home:footer" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-[#071004]" style={{ background: LIME }}>
            Start free <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <StickyStartBar target="start" />

      <footer className="border-t border-white/10 px-4 py-10 pb-24 sm:px-6 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1"><BrandMark size={24} /><span className="text-sm font-semibold">AdLibrarySpy</span><span className="text-sm text-white/45">· Ecommerce intelligence on real data</span><span className="text-sm text-white/45">· Built by <a href="https://x.com/quantummaxing" target="_blank" rel="noopener" className="text-white/70 hover:text-white">@quantummaxing</a></span></div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <Link href="/stores" className="hover:text-white">Shops directory</Link>
            <Link href="/trending" className="hover:text-white">Trending niches &amp; stores</Link>
            <Link href="/weekly" className="hover:text-white">Weekly report</Link>
            <Link href="/vs/trendtrack" className="hover:text-white">vs TrendTrack</Link>
            {extensionUrl && <a href={extensionUrl} target="_blank" rel="noopener" className="hover:text-white">Chrome extension</a>}
            <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-white">GitHub</a>
            {donateUrl && <a href={donateUrl} target="_blank" rel="noopener" className="hover:text-white">Donate</a>}
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/login" className="signed-out-only hover:text-white">Log in</Link>
            <Link href="/shops" className="signed-in-only hover:text-white">Open app</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}


function Kicker({ children }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.35em] text-white/50">
      <span className="h-px w-8" style={{ background: LIME }} aria-hidden />{children}
    </span>
  );
}

function BrowserBar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map(i => <i key={i} className="h-2.5 w-2.5 rounded-full bg-white/20" />)}</span>
      <span className="mx-auto rounded-md bg-white/[0.06] px-3 py-0.5 text-[11px] text-white/45">{url}</span>
      <span className="w-10" aria-hidden />
    </div>
  );
}

function Shot({ src, url, alt }: { src: string; url: string; alt: string }) {
  return (
    <div className="lp-zoom overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d0c] shadow-[0_40px_120px_-40px_rgba(167,244,90,.25)]">
      <BrowserBar url={url} />
      {/* Every Shot sits below the hero: lazy keeps ~500KB of screenshots off the
          first load (React would otherwise preload each one in <head>). */}
      <img src={src} alt={alt} width={2000} height={1097} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
}

function Feature({ kicker, title, body, cta, points, children }: {
  kicker: string; title: ReactNode; body: string; cta: { href: string; label: string };
  points: [typeof Filter, string][]; reverse?: boolean; children: ReactNode;
}) {
  // Tesla panel: title top-centre, the product filling the screen, actions bottom-centre.
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center px-4 pb-14 pt-24 text-center sm:px-6" aria-label={kicker}>
      <div className="lp-reveal max-w-3xl">
        <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-6xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-[15px] text-white/65 sm:text-base">{body}</p>
      </div>
      <div className="my-10 w-full max-w-6xl flex-1">{children}</div>
      <ul className="lp-reveal flex flex-wrap justify-center gap-x-8 gap-y-2 text-[13px] text-white/60">
        {points.map(([Icon, text]) => <li key={text} className="inline-flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" aria-hidden />{text}</li>)}
      </ul>
      <div className="lp-reveal mt-7 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
        <Link href={cta.href} className="lp-btn lp-btn-primary">{cta.label}</Link>
        <Link href="/stores" className="lp-btn lp-btn-glass">Browse shops</Link>
      </div>
    </section>
  );
}

function Card({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <article className="lp-reveal flex min-w-0 flex-col gap-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>
      </div>
      {children}
    </article>
  );
}

