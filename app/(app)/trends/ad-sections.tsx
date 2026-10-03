import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandLogo } from '@/components/market/BrandLogo';
import { ProductImage } from '@/components/ShopMedia';
import { compact, flag, money } from '@/lib/format';
import { liftLabel, weekLabel } from '@/lib/trends';
import { lastDay, loadAdTrends, loadHotProducts, loadVideoStyles, movingNiches, type AdShare, type AdStore, type AdTrends } from './load';
import { TrendProductCard } from './product-card';

// The daily half of /trends: what advertisers launched on Meta in the last 7
// full days vs the 7 before (ClickHouse market__creatives by ad start date).
// Signed-in only: every row opens the ads behind it.

const seeAll = 'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground';
const up = 'text-emerald-600 dark:text-emerald-400';
const down = 'text-rose-600 dark:text-rose-400';
const n = (v: number) => v.toLocaleString('en-US');

/** Weeks back the page can be read at (0 = the latest full week). */
export const WEEKS_BACK = 4;
export const parseWeeksBack = (v?: string) => Math.min(WEEKS_BACK - 1, Math.max(0, Number.parseInt(v ?? '', 10) || 0));

/**
 * The week's exclusive end as a UTC date — also the cache key, so the latest week
 * rolls over at midnight UTC. `back` steps whole weeks into the past.
 */
export const weekEnd = (back = 0) => new Date(Date.now() - back * 7 * 86_400_000).toISOString().slice(0, 10);

export async function loadAds(back = 0): Promise<AdTrends | null> {
  return loadAdTrends(weekEnd(back)).catch(err => { console.error('[trends ads]', err); return null; });
}

/** /ads query for one week ("from=…&to=…"), the same window the numbers count. */
const range = (d: { from: string; to: string }) => `from=${d.from}&to=${lastDay(d.to)}`;

function Change({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return null;
  const pct = Math.round((cur / prev - 1) * 100);
  if (!pct) return <span className="text-xs text-muted-foreground">same as the week before</span>;
  return <span className={`text-xs font-medium tabular-nums ${pct > 0 ? up : down}`}>{pct > 0 ? '+' : '−'}{Math.abs(pct)}% vs the week before</span>;
}

// ---------- the week at a glance ----------

export function AdPulse({ d, back = 0 }: { d: AdTrends; back?: number }) {
  const tiles = [
    { label: 'New Meta ads launched', cur: d.newAds, prev: d.prevNewAds },
    { label: 'Brands launching ads', cur: d.advertisers, prev: d.prevAdvertisers },
  ];
  return (
    <SectionCard
      title={back ? `Meta ads, ${weekLabel(d.from, d.to)}` : 'This week in Meta ads'}
      description={`Ads that started running ${weekLabel(d.from, d.to)}, compared with the week before.`}
      actions={<Link href={`/ads?${range(d)}`} className={seeAll}>See these ads <ArrowRight className="h-4 w-4" /></Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{n(t.cur)}</p>
              <Change cur={t.cur} prev={t.prev} />
            </div>
          ))}
          <p className="col-span-2 text-xs text-muted-foreground">
            We find more of Meta&apos;s ads every week, so totals rise partly from that. The niche and format changes on this page compare each one&apos;s share of all new ads, which that does not move.
          </p>
        </div>
        {d.formats.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">What ads look like now</h3>
            <ul className="mt-3 space-y-2.5">
              {d.formats.map(f => (
                <li key={f.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground">{f.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(f.share * 100)}% <Lift lift={f.lift} />
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, f.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {d.placements.length > 0 && <>
              <h3 className="mt-6 text-sm font-semibold text-foreground">Where they run</h3>
              <p className="text-xs text-muted-foreground">Share of new ads placed on each app. Most ads run on several, so these add up to more than 100%.</p>
              <ul className="mt-3 space-y-2.5">
                {d.placements.map(f => (
                  <li key={f.id}>
                    <Link href={`/ads?placement=${f.id}&${range(d)}`} className="-mx-2 block rounded-md px-2 py-1 hover:bg-accent">
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground">{f.name}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(f.share * 100) || '<1'}% <Lift lift={f.lift} /></span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1, Math.min(100, f.share * 100))}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function Lift({ lift }: { lift: number }) {
  const label = liftLabel(lift);
  return (
    <span className={`ml-1 text-xs font-medium tabular-nums ${label === 'same' ? 'text-muted-foreground' : lift > 1 ? up : down}`}
      title="Change in its share of all new ads vs the week before">
      {label === 'same' ? 'no change' : label}
    </span>
  );
}

// ---------- video styles ----------

export async function VideoStylesSection({ back = 0 }: { back?: number }) {
  const d = await loadVideoStyles(weekEnd(back)).catch(err => { console.error('[trends styles]', err); return null; });
  if (!d?.styles.length) return null;
  return (
    <SectionCard
      title="Video styles advertisers are using"
      description={`How the week's new video ads are made, from ${n(d.styled)} we watched (${weekLabel(d.from, d.to)}). Change is each style's share vs the week before.`}
      actions={<Link href={`/ads?media=video&${range(d)}`} className={seeAll}>See video ads <ArrowRight className="h-4 w-4" /></Link>}
    >
      <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2">
        {d.styles.map(s => (
          <li key={s.id}>
            <Link href={`/ads?style=${s.id}&${range(d)}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {Math.round(s.share * 100) || '<1'}%{s.lift != null && <Lift lift={s.lift} />}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1, s.share * 100)}%` }} />
                </span>
              </span>
              {s.ads.length > 0 && (
                <span className="flex shrink-0 gap-1">
                  {s.ads.slice(0, 3).map(a => (
                    <ProductImage key={a.id} src={a.image} alt="" className="h-10 w-10 rounded-md border border-border object-cover max-sm:[&:nth-child(n+3)]:hidden" />
                  ))}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ---------- products ----------

export async function HotProductsSection() {
  const items = await loadHotProducts().catch(() => []);
  if (items.length < 4) return null;
  return (
    <SectionCard
      title="Products getting the most new ads"
      description="Store products that the most new Meta ads started pointing to in the last 14 days. One per store."
      actions={<Link href="/products?sort=new_ads" className={seeAll}>See all <ArrowRight className="h-4 w-4" /></Link>}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map(p => (
          <TrendProductCard key={p.key}
            href={p.store.id ? `/shops/${p.store.id}` : p.url} external={!p.store.id}
            title={p.title} image={p.image} shopName={p.store.title || p.store.domain} domain={p.store.domain}
            price={p.price != null && p.currency ? money(p.price, p.currency) : undefined}
            badge={`${n(p.newAds14d)} new ads`} badgeTitle={`${n(p.activeAds)} of its ${n(p.ads)} ads are running now, from ${n(p.pages)} Facebook pages`} />
        ))}
      </ul>
    </SectionCard>
  );
}

// ---------- stores ----------

function StoreCell({ s }: { s: AdStore }) {
  return (
    <Link href={`/shops/${s.id}`} className="flex min-w-0 items-center gap-3">
      <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={32} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground hover:underline">{s.name}</span>
          {flag(s.country) && <span className="text-[13px] leading-none" title={`Shop origin: ${s.country}`}>{flag(s.country)}</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{s.niche || s.domain}</span>
      </span>
    </Link>
  );
}

function AdThumbs({ s, d }: { s: AdStore; d: AdTrends }) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      {s.ads.map(a => (
        <Link key={a.id} href={`/ads/${a.id}`} scroll={false} className="shrink-0 overflow-hidden rounded-md empty:hidden" aria-label={`Ad by ${s.name}`}>
          <ProductImage src={a.image} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
        </Link>
      ))}
      <Link href={`/ads?store=${encodeURIComponent(s.domain)}&${range(d)}`} className="ml-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">
        See ads
      </Link>
    </span>
  );
}

export function ScalingSection({ d }: { d: AdTrends }) {
  if (!d.scaling.length) return null;
  return (
    <SectionCard padded={false} title="Stores launching the most ads"
      description={`Shopify stores by new Meta ads started ${weekLabel(d.from, d.to)}. A store pushing out this many new ads is testing hard or scaling what works.`}>
      <Table className="max-sm:table-fixed sm:min-w-[860px] max-sm:[&_tr>*:nth-child(1)]:hidden max-sm:[&_tr>*:nth-child(4)]:hidden max-sm:[&_tr>*:nth-child(5)]:hidden max-sm:[&_tr>*:nth-child(6)]:hidden max-sm:[&_tr>*:nth-child(7)]:hidden max-sm:[&_tr>*:nth-child(2)]:pl-6" containerClassName="pt-2">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 pl-6">#</TableHead>
            <TableHead className="max-sm:w-[65%]">Shop</TableHead>
            <TableHead className="text-right">New ads<span className="max-sm:hidden"> that week</span></TableHead>
            <TableHead className="text-right">Week before</TableHead>
            <TableHead className="text-right" title="Facebook pages the new ads ran from">Pages</TableHead>
            <TableHead className="text-right">Video</TableHead>
            <TableHead className="pr-6 text-right">Latest ads</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.scaling.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="pl-6 tabular-nums text-muted-foreground">{i + 1}</TableCell>
              <TableCell><StoreCell s={s} /><div className="mt-2 sm:hidden [&>span]:justify-start"><AdThumbs s={s} d={d} /></div></TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-foreground">{n(s.newAds)}</TableCell>
              <TableCell className="text-right">
                <span className="block tabular-nums text-muted-foreground">{n(s.prevAds)}</span>
                {s.prevAds > 0 && s.newAds >= 2 * s.prevAds && <span className={`text-xs font-medium ${up}`}>{Math.round(s.newAds / s.prevAds)}× more</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{n(s.pages)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{Math.round(s.videoShare * 100)}%</TableCell>
              <TableCell className="pr-6"><AdThumbs s={s} d={d} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

export function NewBrandsSection({ d }: { d: AdTrends }) {
  if (!d.newBrands.length) return null;
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <SectionCard padded={false} title="New brands that just started advertising"
      description={`Shopify stores whose first Meta ad ever started in the week, already with 20+ ads (${weekLabel(d.from, d.to)}). Catch them before everyone else does.`}>
      <Table className="max-sm:table-fixed sm:min-w-[760px] max-sm:[&_tr>*:nth-child(2)]:hidden max-sm:[&_tr>*:nth-child(4)]:hidden max-sm:[&_tr>*:nth-child(5)]:hidden" containerClassName="pt-2">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6 max-sm:w-[65%]">Shop</TableHead>
            <TableHead className="text-right">First ad</TableHead>
            <TableHead className="text-right">Ads so far</TableHead>
            <TableHead className="text-right">Video</TableHead>
            <TableHead className="pr-6 text-right">Latest ads</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.newBrands.map(s => (
            <TableRow key={s.id}>
              <TableCell className="pl-6"><StoreCell s={s} /><div className="mt-2 sm:hidden [&>span]:justify-start"><AdThumbs s={s} d={d} /></div></TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{s.firstAd ? day(s.firstAd) : null}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-foreground">{n(s.newAds)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{Math.round(s.videoShare * 100)}%</TableCell>
              <TableCell className="pr-6"><AdThumbs s={s} d={d} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

// ---------- niches ----------

export function AdNichesSection({ d }: { d: AdTrends }) {
  const { rising, cooling } = movingNiches(d.niches);
  if (!rising.length && !cooling.length) return null;
  const col = (title: string, rows: AdShare[]) => rows.length > 0 && (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 divide-y divide-border">
        {rows.map(x => (
          <li key={x.id}>
            <Link href={`/ads?niche=${x.id}&${range(d)}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{x.name}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">{n(x.cur)} new ads · {n(x.prev)} the week before</span>
              </span>
              {!!x.ads?.length && (
                <span className="flex shrink-0 gap-1">
                  {x.ads.map(a => (
                    <ProductImage key={a.id} src={a.image} alt="" className="h-9 w-9 rounded-md border border-border object-cover max-sm:[&:nth-child(n+3)]:hidden" />
                  ))}
                </span>
              )}
              <span className="w-12 shrink-0 text-right"><Lift lift={x.lift} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <SectionCard title="Niches where advertisers are moving"
      description={`Each niche's share of all new Meta ads, ${weekLabel(d.from, d.to)} vs the week before. Rising = advertisers are putting more of their testing there.`}>
      <div className="grid gap-6 md:grid-cols-2">
        {col('Rising', rising)}
        {col('Cooling', cooling)}
      </div>
    </SectionCard>
  );
}
