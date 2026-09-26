import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import type { WeeklyReport, WeeklySection } from '@/lib/weekly/types';
import { flag } from '@/lib/format';
import { BrandLogo } from '@/components/market/BrandLogo';
import { ProductImage } from '@/components/ShopMedia';
import { ShareButton } from '@/components/market/ShareButton';
import { countryName } from '@/components/market/CreativeCard';
import { JsonLd } from '@/components/public/PublicCards';
import { SITE_URL, signupFor, storePath } from '@/lib/public/site';

const CARD = 'rounded-xl border border-border bg-card';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 21 – 27, 2026" / "Sep 28 – Oct 4, 2026" / "Dec 28, 2026 – Jan 3, 2027". */
export function weekRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (!ys || !ye) return '';
  if (ys !== ye) return `${MONTHS[ms - 1]} ${ds}, ${ys} – ${MONTHS[me - 1]} ${de}, ${ye}`;
  if (ms !== me) return `${MONTHS[ms - 1]} ${ds} – ${MONTHS[me - 1]} ${de}, ${ys}`;
  return `${MONTHS[ms - 1]} ${ds} – ${de}, ${ys}`;
}

export const weekPath = (week: string) => `/weekly/${week}`;

function Section({ s }: { s: WeeklySection }) {
  return (
    <section aria-labelledby={`s-${s.key}`} className={CARD}>
      <header className="border-b border-border px-5 py-4">
        <h2 id={`s-${s.key}`} className="text-lg font-semibold tracking-tight text-foreground">{s.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{s.blurb}</p>
      </header>
      <ol className="divide-y divide-border">
        {s.items.map((it, i) => (
          <li key={it.domain}>
            <Link href={storePath(it.domain)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-hover)]">
              <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
              <BrandLogo logo={it.logo} domain={it.domain} name={it.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{it.name}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{it.domain}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {[it.niche, it.country && `${flag(it.country)} ${countryName(it.country)}`.trim()].filter(Boolean).join(' · ')}
                  {(it.niche || it.country) && ' · '}
                  {it.detail}
                </div>
              </div>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{it.metric}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Source: {s.source}</p>
    </section>
  );
}

function Subscribe() {
  return (
    <div className={`${CARD} flex flex-col gap-3 bg-[var(--surface)] p-5 sm:flex-row sm:items-center`}>
      <Mail className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">Get this every Monday — free</div>
        <p className="mt-0.5 text-sm text-muted-foreground">Create a free account and switch on the weekly report. No card, one email a week, unsubscribe in one click.</p>
      </div>
      <Link href={signupFor('/settings/newsletter')} className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5">
        Get it free<ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function WeeklyReportView({ report, archive }: { report: WeeklyReport; archive: { week: string; label: string }[] }) {
  const d = report.data;
  const url = `${SITE_URL}${weekPath(report.week)}`;
  const range = weekRange(d.weekStart, d.weekEnd);
  const others = archive.filter(a => a.week !== report.week);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${d.weekLabel}: the stores scaling right now`,
    datePublished: report.publishedAt,
    url,
    publisher: { '@type': 'Organization', name: 'AdLibrarySpy', url: SITE_URL },
    mainEntityOfPage: url,
  };

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <JsonLd data={jsonLd} />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The Monday report</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{d.weekLabel}: the stores scaling right now</h1>
        <p className="text-sm text-muted-foreground">
          {range && <>{range} · </>}What moved in AdLibrarySpy&apos;s index of Shopify stores and Meta ads this week. Every figure is measured, with its source under each list.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton path={weekPath(report.week)} title={`${d.weekLabel} ecommerce report`} label />
          <Link href={signupFor('/settings/newsletter')} className="btn-primary inline-flex h-9 items-center gap-1.5 text-sm">
            Get this every Monday — free<ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      {d.sections.map((s, i) => (
        <div key={s.key} className="space-y-6">
          <Section s={s} />
          {i === 1 && <Subscribe />}
        </div>
      ))}

      {d.products.length > 0 && (
        <section aria-labelledby="s-products" className={CARD}>
          <header className="border-b border-border px-5 py-4">
            <h2 id="s-products" className="text-lg font-semibold tracking-tight text-foreground">Products from these stores</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Listed on the featured stores&apos; own storefronts.</p>
          </header>
          <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-4">
            {d.products.map(p => (
              <li key={`${p.domain}-${p.title}`}>
                <Link href={storePath(p.domain)} className="group block">
                  <ProductImage src={p.image} alt={p.title} className="aspect-square w-full rounded-lg border border-border bg-white object-contain" />
                  <div className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:underline">{p.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.storeName}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Subscribe />

      {others.length > 0 && (
        <nav aria-label="Earlier reports" className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Earlier reports</h2>
          <ul className="flex flex-wrap gap-2">
            {others.map(a => (
              <li key={a.week}><Link href={weekPath(a.week)} className="btn-ghost h-8 px-3 text-xs">{a.label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  );
}
