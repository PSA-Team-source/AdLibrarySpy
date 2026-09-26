import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { marketGet, unwrapTotal } from '@/lib/market/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * /vs/trendtrack — honest side-by-side. Anonymous and identical for every
 * visitor (no cookies/session), so the edge can cache it; rebuilt hourly.
 *
 * TrendTrack column = what trendtrack.io/pricing showed on CHECKED (plan cards,
 * monthly prices from the page's billing toggle, "Compare Plans" table + FAQ;
 * the Chrome extension from the site's own navigation). Our column = what the app ships today, read
 * from the code: Meta-only ad index (app/(app)/ads/page.tsx), 12 MCP tools
 * (lib/mcp/tools.ts), no Brandtracker cap, API keys that authenticate MCP only.
 * Re-check their page before editing their column; never add a claim for us
 * that the app does not back.
 */
export const revalidate = 3600;

const CHECKED = '26 September 2026';
const TITLE = 'AdLibrarySpy vs TrendTrack: a free TrendTrack alternative';
const DESCRIPTION =
  'An honest comparison of AdLibrarySpy and TrendTrack: price, shop explorer, Meta ads library, brand tracking, team seats and AI (MCP) access, plus what TrendTrack has that we do not.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/vs/trendtrack' },
  openGraph: { type: 'article', url: '/vs/trendtrack', title: TITLE, description: DESCRIPTION, siteName: 'AdLibrarySpy' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

/** Live index sizes; a failed call drops that figure rather than printing a stale one. */
async function indexSizes(): Promise<{ shops: number | null }> {
  const shops = await marketGet('/top-brands?platform=all&page=1&limit=1', { revalidate: 3600, retries: 1 }).then(unwrapTotal).catch(() => null);
  return { shops: shops && shops > 0 ? shops : null };
}

const millions = (n: number) => `${(Math.floor(n / 100_000) / 10).toLocaleString('en-US')} million`;

type Cell = { yes: boolean; text: string };
const Y = (text: string): Cell => ({ yes: true, text });
const N = (text: string): Cell => ({ yes: false, text });

const ROWS: { feature: string; ours: Cell; theirs: Cell }[] = [
  { feature: 'Price',
    ours: Y('Free. No card, no plans, no credits.'),
    theirs: N('Paid: Starter $49, Pro $89, Business $159 per month billed monthly (less with quarterly or annual billing). Enterprise is custom.') },
  { feature: 'Shop explorer with filters',
    ours: Y('Traffic, growth, niche, country, products, price, technology and pixel filters.'),
    theirs: Y('Smart segments and advanced filters on every plan.') },
  { feature: 'Shop lookups',
    ours: Y('No weekly cap.'),
    theirs: N('5 a week on Starter, 30 on Pro, unlimited on Business.') },
  { feature: 'Store traffic',
    ours: Y('SimilarWeb-measured visits for the exact store host.'),
    theirs: Y('Powered by SimilarWeb, per their FAQ.') },
  { feature: 'Shop analytics and similar shops',
    ours: Y('Per-shop dossier with traffic, ads, products and similar shops.'),
    theirs: Y('Included on every plan.') },
  { feature: 'Meta ads library',
    ours: Y('Search, filter and save Meta ads.'),
    theirs: Y('Pro and Business plans; not on Starter.') },
  { feature: 'Google ads library',
    ours: N('Not available.'),
    theirs: Y('Pro and Business plans.') },
  { feature: 'TikTok ads library',
    ours: N('Not available.'),
    theirs: Y('Pro and Business plans.') },
  { feature: 'EU ad reach and spend estimates',
    ours: N('Not available.'),
    theirs: Y('Pro and Business plans, from Meta’s EU transparency data.') },
  { feature: 'Search ads by image',
    ours: N('Not available.'),
    theirs: Y('Pro and Business plans.') },
  { feature: 'Advertisers (Facebook pages)',
    ours: Y('Browse advertisers with their live ads.'),
    theirs: Y('2,000 page results a month on Pro, unlimited on Business; not on Starter.') },
  { feature: 'Brand tracking',
    ours: Y('Brandtracker with daily snapshots, no brand cap.'),
    theirs: Y('2 brands on Starter, 10 on Pro, 20 on Business.') },
  { feature: 'Email and newsletter library',
    ours: N('Not available.'),
    theirs: Y('Flows and campaigns; capped on Starter, unlimited on Pro and Business.') },
  { feature: 'Team seats',
    ours: Y('Invite your team free; share saved shops and ads.'),
    theirs: N('1 user on Starter and Pro, 3 included on Business, then $29 per seat.') },
  { feature: 'AI assistant access (MCP)',
    ours: Y('12 MCP tools over OAuth or an API key, for Claude and other MCP clients.'),
    theirs: Y('API/MCP access on Pro and Business, metered by credits and rate limits.') },
  { feature: 'REST data API',
    ours: N('Not available; API keys authenticate the MCP endpoint only.'),
    theirs: Y('Rate-limited API on Pro and Business.') },
  { feature: 'Chrome extension',
    ours: Y('Free and open source: shows a store’s traffic, live Meta ads, products, apps and pixels. Install it from source today; Chrome Web Store listing coming.'),
    theirs: Y('Free extension.') },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Is AdLibrarySpy really free?',
    a: 'Yes. Every feature is free for every workspace: there are no plans, trials, credits or card details. Rate limits exist only to stop abuse.' },
  { q: 'What does TrendTrack have that AdLibrarySpy does not?',
    a: 'Google and TikTok ad libraries, EU ad reach and spend estimates, search by image, an email and newsletter library and a REST API.' },
  { q: 'Where does the traffic data come from?',
    a: 'Store visits are SimilarWeb measurements for the exact store host. TrendTrack also states its traffic is powered by SimilarWeb.' },
  { q: 'Can my team use it?',
    a: 'Yes. Invite teammates from Settings, Members at no cost and share saved shops and ads across the workspace.' },
];

function Mark({ cell }: { cell: Cell }) {
  return (
    <div className="flex items-start gap-2">
      {cell.yes
        ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Yes" />
        : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="No" />}
      <span className="text-sm text-foreground">{cell.text}</span>
    </div>
  );
}

export default async function VsTrendTrackPage() {
  const { shops } = await indexSizes();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <article className="mx-auto max-w-[960px] space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="space-y-4 pt-2">
        <p className="text-sm font-medium text-muted-foreground">Comparison</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">AdLibrarySpy vs TrendTrack</h1>
        <p className="max-w-[680px] text-base text-muted-foreground">
          Both help ecommerce teams find fast-growing shops and the ads behind them. AdLibrarySpy is free, with no plans
          or card. TrendTrack is a paid tool that covers more ad networks and includes email data. Here is the honest breakdown.
        </p>
        {shops && (
          <p className="text-sm text-muted-foreground">
            Our index today: <span className="font-medium text-foreground">{millions(shops)} shops across all platforms</span>.
          </p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/signup" className="btn-primary inline-flex items-center gap-1.5">Start free<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          <Link href="/stores" className="btn-ghost">Browse the shops directory</Link>
        </div>
      </header>

      <section aria-labelledby="table-h" className="space-y-3">
        <h2 id="table-h" className="text-xl font-semibold text-foreground">Feature by feature</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[26%]">Feature</TableHead>
                <TableHead className="w-[37%]">AdLibrarySpy</TableHead>
                <TableHead className="w-[37%]">TrendTrack</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(r => (
                <TableRow key={r.feature}>
                  <TableCell className="align-top text-sm font-medium text-foreground">{r.feature}</TableCell>
                  <TableCell className="align-top"><Mark cell={r.ours} /></TableCell>
                  <TableCell className="align-top"><Mark cell={r.theirs} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">TrendTrack details from its public pricing page as checked on {CHECKED}.</p>
      </section>

      <section aria-labelledby="gap-h" className="space-y-3">
        <h2 id="gap-h" className="text-xl font-semibold text-foreground">What TrendTrack does that we don&apos;t</h2>
        <p className="text-sm text-muted-foreground">If any of these are essential to you, TrendTrack is the better fit today:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
          <li>Google and TikTok ad libraries. Our ad index is Meta only.</li>
          <li>EU reach and spend estimates per ad and per tracked brand.</li>
          <li>Search ads by image.</li>
          <li>An email and newsletter library (flows and campaigns).</li>
          <li>A rate-limited REST API. Ours is MCP only.</li>
        </ul>
      </section>

      <section aria-labelledby="pick-h" className="space-y-3">
        <h2 id="pick-h" className="text-xl font-semibold text-foreground">Why teams pick AdLibrarySpy</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
          <li>It costs nothing: no card, no trial clock, no credits that run out mid-research.</li>
          <li>No lookup quotas and no cap on tracked brands.</li>
          <li>Unlimited teammates at no extra cost, with shared saved shops and ads.</li>
          <li>Built-in MCP server, so Claude and other AI assistants can search shops and ads for you.</li>
        </ul>
      </section>

      <section aria-labelledby="faq-h" className="space-y-4">
        <h2 id="faq-h" className="text-xl font-semibold text-foreground">Questions</h2>
        <dl className="space-y-4">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-xl border border-border bg-card p-5">
              <dt className="text-sm font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Try it free</h2>
          <p className="text-sm text-muted-foreground">Sign up with just your email: we send a sign-in link, no password. No card.</p>
        </div>
        <Link href="/signup" className="btn-primary inline-flex items-center gap-1.5">Start free<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
      </section>

      <p className="text-xs text-muted-foreground">
        TrendTrack is a trademark of its owner. AdLibrarySpy is not affiliated with TrendTrack and is not endorsed by
        it. TrendTrack details come from its public website as of {CHECKED} and may have changed since.
      </p>
    </article>
  );
}
