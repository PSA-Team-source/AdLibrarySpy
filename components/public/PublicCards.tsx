import Link from 'next/link';
import { ArrowRight, Calendar, LayoutGrid, Lock, Users } from 'lucide-react';
import type { Ad, CountryShare, Shop } from '@/lib/types';
import { compact, flag, monthYear } from '@/lib/format';
import { formatCount } from '@/lib/market-format';
import { CreativeMedia } from '@/components/market/CreativeMedia';
import { BrandLogo } from '@/components/market/BrandLogo';
import { ActiveDot } from '@/components/market/AdBadges';
import { ProductImage } from '@/components/ShopMedia';
import { activePeriod, countryName } from '@/components/market/CreativeCard';
import { adPath, measuredVisits, storePath } from '@/lib/public/site';

/**
 * Anonymous twins of the signed-in cards (CreativeCard, the dossier's SimilarCard):
 * same tokens and layout, but every link stays on the public surface (/ad, /store)
 * and nothing needs a session (no Fav/Track state). Absent data = absent element.
 */

export function PublicCreativeTile({ ad }: { ad: Ad }) {
  const period = activePeriod(ad);
  return (
    <Link href={adPath(ad.id)} className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20"
      aria-label={`Ad by ${ad.advertiser}${ad.headline ? `: ${ad.headline}` : ''}`}>
      <CreativeMedia image={ad.image} videoUrl={ad.videoUrl} alt={ad.headline || `Ad by ${ad.advertiser}`} className="aspect-[4/5] w-full" autoPlayOnHover={false} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        {ad.headline && <div className="line-clamp-2 text-xs font-semibold text-foreground">{ad.headline}</div>}
        {period && (
          <div className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <ActiveDot isActive={ad.isActive} />
            <span className="truncate">{period.from}{period.to && ` → ${period.to === 'now' ? 'now' : period.to}`}</span>
            {ad.country && <span className="ml-auto" title={countryName(ad.country)}>{flag(ad.country)}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

export function PublicShopCard({ shop }: { shop: Shop }) {
  const visits = measuredVisits(shop);
  const thumbs = shop.bestSellers.filter(p => p.image).slice(0, 4);
  return (
    <Link href={storePath(shop.domain)} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-2">
        <BrandLogo logo={shop.logo} domain={shop.domain} name={shop.name} size={28} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground" title={shop.fullTitle}>{shop.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{shop.domain}</div>
        </div>
        {shop.country && <span className="ml-auto" aria-label={countryName(shop.country)}>{flag(shop.country)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {shop.metaAds > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />{formatCount(shop.metaAds)} live ads</span>}
        {visits > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><Users className="h-3 w-3" aria-hidden />{compact(visits)}/mo</span>}
        {shop.createdOn && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><Calendar className="h-3 w-3" aria-hidden />{monthYear(shop.createdOn)}</span>}
        {shop.productCount > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><LayoutGrid className="h-3 w-3" aria-hidden />{compact(shop.productCount)} products</span>}
      </div>
      {thumbs.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {thumbs.map(p => <ProductImage key={`${p.rank}-${p.title}`} src={p.image!} alt={p.title} className="aspect-square w-full rounded-md border border-border object-cover" />)}
        </div>
      )}
    </Link>
  );
}

/** Flag + share row, as the dossier's chart footers render visitor and targeted countries. */
export function CountryShares({ label, data }: { label: string; data: CountryShare[] }) {
  if (!data.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-3 tabular-nums text-foreground">
        {data.slice(0, 5).map(c => <span key={c.code} title={countryName(c.code)}><span aria-hidden>{flag(c.code)}</span> {c.pct}%</span>)}
      </span>
    </div>
  );
}

/** A gated action: what the free account unlocks, and the one button that gets it. */
export function SignupGate({ title, body, href, cta = 'Sign up free' }: { title: string; body: string; href: string; cta?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-[var(--surface)] p-5 sm:flex-row sm:items-center">
      <Lock className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <Link href={href} className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5">{cta}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
    </div>
  );
}

/** JSON-LD script; `<` escaped so a merchant-controlled string cannot close the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
