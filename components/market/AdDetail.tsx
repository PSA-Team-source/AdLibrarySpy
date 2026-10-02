import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity, CalendarClock, CalendarRange, Eye, Clock, Hash, Film, Image as ImageIcon, Globe, ExternalLink,
  Download, LayoutGrid, Store, Tag, Layers, TrendingUp, Bookmark,
} from 'lucide-react';
import type { Ad } from '@/lib/types';
import { metaAdLibraryUrl } from '@/lib/market/creatives';
import { categories } from '@/lib/market/shops';
import { getShop, similarAds } from '@/lib/data';
import { dateShort, flag, ageOf } from '@/lib/format';
import { formatCount } from '@/lib/market-format';
import FavButton from '@/components/FavButton';
import { CreativeMedia } from './CreativeMedia';
import { ActiveDot, FormatBadge, placementLabel } from './AdBadges';
import { BrandLogo } from './BrandLogo';
import { AdBoards, AdDrawerNav, DetailTabs, ExpandableCopy } from './AdClient';
import { ShareButton } from './ShareButton';
import { adPath, signupFor, storePath } from '@/lib/public/site';
import { favoritesIn, listFolders } from '@/lib/favorite-folders';
import { activePeriod, countryName, hostOf } from './CreativeCard';

/** UTM keys in the order a media buyer reads them. */
const UTM_ORDER = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_format'];

const FORMAT_NAME: Record<string, string> = { dco: 'Dynamic creative', dpa: 'Catalogue (DPA)', carousel: 'Carousel', video: 'Video', image: 'Image' };

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <dt className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{icon}{label}</dt>
      <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <h3 className="px-3 pb-1 pt-3 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="divide-y divide-border">{children}</dl>
      {note && <p className="px-3 pb-3 pt-1 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

const ico = 'h-3.5 w-3.5';

/**
 * One creative, two-column drawer layout: preview on the left, Ads Details and
 * Shop Details on the right. Every row is a field the index holds for this ad;
 * a missing field is a missing row. Rendered in the grid's drawer and as the
 * standalone /ads/[id] page (shared links, reloads).
 *
 * `publicView` renders the anonymous /ad/[id] page: no session reads (it is edge
 * cached), links stay on the public surface (/ad, /store), and Save / All ads are
 * sign-up CTAs instead of workspace actions.
 */
export async function AdDetail(props: { ad: Ad; drawer: boolean } & (
  { publicView: true } | { publicView?: false; workspaceId: string; userId: string }
)) {
  const { ad, drawer } = props;
  const viewer = props.publicView ? null : { workspaceId: props.workspaceId, userId: props.userId };
  const adHref = (id: string) => (viewer ? `/ads/${id}` : adPath(id));
  const [shop, similar, saves, boards, cats] = await Promise.all([
    ad.shopId ? getShop(ad.shopId).catch(() => null) : Promise.resolve(null),
    similarAds(ad, 8).catch(() => []),
    // Saved state and boards are secondary: a slow app DB must not blank the ad.
    viewer ? favoritesIn(viewer.workspaceId, viewer.userId, 'ad', 'all').catch(() => null) : Promise.resolve(null),
    viewer ? listFolders(viewer.workspaceId, viewer.userId, 'ad').catch(() => null) : Promise.resolve(null),
    ad.storeCategoryIds.length ? categories() : Promise.resolve({} as Record<string, string>),
  ]);
  const savedEntry = saves?.find(s => s.id === ad.id);

  const period = activePeriod(ad);
  const seenMs = ad.lastSeenAt ? new Date(ad.lastSeenAt).getTime() : 0;
  const status = !ad.isActive
    ? { label: 'Stopped', live: false }
    : seenMs && Date.now() - seenMs < 3 * 86_400_000
      ? { label: 'Still running', live: true }
      : { label: seenMs ? `Running at last crawl (${dateShort(ad.lastSeenAt)})` : 'Running at last crawl', live: true };
  const media = ad.videoUrl || ad.image;
  const libraryUrl = metaAdLibraryUrl(ad);
  const destinationHost = hostOf(ad.linkUrl);
  const categoryPath = [...new Set(ad.storeCategoryIds.map(id => cats[id]).filter(Boolean))];
  const utmKeys = UTM_ORDER.filter(k => ad.utm[k]).concat(Object.keys(ad.utm).filter(k => !UTM_ORDER.includes(k)));

  const l = ad.labels;
  const breakdown = l
    ? [
        l.style && { name: 'Video style', value: l.style.label, confidence: l.style.confidence },
        l.hook && { name: 'Hook', value: l.hook.label, confidence: l.hook.confidence },
        l.angle && { name: 'Angle', value: l.angle.label, confidence: l.angle.confidence },
        l.funnelStage && { name: 'Funnel stage', value: l.funnelStage.label, confidence: l.funnelStage.confidence },
        l.offer && { name: 'Offer', value: l.offer.label, confidence: l.offer.confidence },
        l.urgency && { name: 'Urgency', value: 'Urgent copy', confidence: l.urgency.probability },
      ].filter((r): r is { name: string; value: string; confidence: number } => !!r)
    : [];

  const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground';
  const primaryPlacement = ad.placements[0] ? placementLabel(ad.placements[0]) : 'Meta';

  const adsDetails = (
    <div className="flex flex-col gap-4">
      <Section title="Performance Signals">
        <Row icon={<Activity className={ico} />} label="Status">
          <span className="inline-flex items-center gap-1.5"><ActiveDot isActive={status.live} />{status.label}</span>
        </Row>
        {ad.daysRunning > 0 && (
          <Row icon={<Clock className={ico} />} label="Time Running">{ad.daysRunning} days</Row>
        )}
        {period && (
          <Row icon={<CalendarRange className={ico} />} label="Active Period">
            {dateShort(ad.startDate)} → {period.to === 'now' ? 'Today' : period.to ? dateShort(ad.lastSeenAt) : '…'}
          </Row>
        )}
        {ad.adsRunning > 0 && (
          <Row icon={<TrendingUp className={ico} />} label="Advertiser live ads">{formatCount(ad.adsRunning)}</Row>
        )}
        {ad.firstSeenAt && (
          <Row icon={<Eye className={ico} />} label="First Seen">{dateShort(ad.firstSeenAt)}</Row>
        )}
      </Section>

      <Section title="Creative & Links">
        {ad.postId && (
          <Row icon={<Hash className={ico} />} label="Meta post ID"><span className="font-mono text-xs">{ad.postId}</span></Row>
        )}
        {ad.pageId && (
          <Row icon={<Hash className={ico} />} label="Meta page ID"><span className="font-mono text-xs">{ad.pageId}</span></Row>
        )}
        <Row icon={ad.mediaType === 'video' ? <Film className={ico} /> : <ImageIcon className={ico} />} label="Format">
          {FORMAT_NAME[ad.format] ?? (ad.mediaType === 'video' ? 'Video' : 'Image')}
          {FORMAT_NAME[ad.format] && ad.format !== ad.mediaType && ` · ${ad.mediaType === 'video' ? 'Video' : 'Image'}`}
        </Row>
        {ad.placements.length > 0 && (
          <Row icon={<LayoutGrid className={ico} />} label="Placements">{ad.placements.map(placementLabel).join(', ')}</Row>
        )}
        {ad.country && (
          <Row icon={<Globe className={ico} />} label="Country">{flag(ad.country)} {countryName(ad.country)}</Row>
        )}
        {ad.linkUrl && (
          <Row icon={<Globe className={ico} />} label="Landing Page">
            <a href={ad.linkUrl} target="_blank" rel="noopener nofollow" title={ad.linkUrl}
              className="inline-flex max-w-[260px] items-center gap-1 text-foreground hover:underline">
              <span className="truncate">{ad.linkUrl.replace(/^https?:\/\//, '')}</span><ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </Row>
        )}
        <Row icon={<ExternalLink className={ico} />} label="Original Ad">
          <a href={libraryUrl} target="_blank" rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 hover:underline">Open in Meta Ad Library <ExternalLink className="h-3 w-3" /></a>
        </Row>
      </Section>

      {breakdown.length > 0 && (
        <Section title="Creative Breakdown" note="AI labels: model judgments of the ad text with their confidence, not measurements.">
          {breakdown.map(r => (
            <Row key={r.name} icon={<Tag className={ico} />} label={r.name}>
              {r.value}<span className="tabular-nums text-muted-foreground"> · {Math.round(r.confidence * 100)}%</span>
            </Row>
          ))}
        </Section>
      )}

      {utmKeys.length > 0 && (
        <Section title="Campaign Tagging" note="Decoded from the landing page's UTM parameters — the advertiser's own campaign naming.">
          {utmKeys.map(k => (
            <Row key={k} icon={<Tag className={ico} />} label={k.replace('utm_', '')}>
              <span className="break-all font-mono text-xs">{ad.utm[k]}</span>
            </Row>
          ))}
        </Section>
      )}

      {similar.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-3">
          <h3 className="pb-2 text-sm font-semibold text-foreground">More from {ad.advertiser}</h3>
          <div className="grid grid-cols-4 items-start gap-2">
            {similar.map(a => (
              <Link key={a.id} href={adHref(a.id)} replace={drawer} scroll={false} title={a.headline || 'Creative'}
                className="overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80">
                <CreativeMedia image={a.image} videoUrl={a.videoUrl} watchUrl={a.adLibraryVideoUrl} alt={a.headline || 'Creative'} className="w-full" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const shopDetails = (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <BrandLogo logo={ad.storeLogo} domain={ad.domain} name={ad.advertiser} size={44} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{shop?.name || ad.advertiser}</p>
            {ad.domain && (
              <a href={`https://${ad.domain}`} target="_blank" rel="noopener nofollow"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {ad.domain}<ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        {ad.storeDescription && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{ad.storeDescription}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {viewer
            ? ad.shopId && <Link href={`/shops/${ad.shopId}`} className="btn-primary h-9 px-3 text-xs"><Store className="h-3.5 w-3.5" /> Shop analytics</Link>
            : (shop?.domain || ad.domain) && <Link href={storePath(shop?.domain || ad.domain)} className="btn-primary h-9 px-3 text-xs"><Store className="h-3.5 w-3.5" /> Shop analytics</Link>}
          {ad.domain && (viewer
            ? <Link href={`/ads?store=${encodeURIComponent(ad.domain)}`} className="btn-ghost h-9 px-3 text-xs"><Layers className="h-3.5 w-3.5" /> All their ads</Link>
            : <Link href={signupFor(`/ads?store=${encodeURIComponent(ad.domain)}`)} className="btn-ghost h-9 px-3 text-xs"><Layers className="h-3.5 w-3.5" /> All their ads — sign up free</Link>)}
        </div>
      </section>
      <Section title="Shop Infos">
        {ad.storeCreatedAt && (
          <Row icon={<CalendarClock className={ico} />} label="Created">
            {dateShort(ad.storeCreatedAt)}{ageOf(ad.storeCreatedAt) && <span className="text-muted-foreground"> · {ageOf(ad.storeCreatedAt)}</span>}
          </Row>
        )}
        {categoryPath.length > 0 && (
          <Row icon={<Tag className={ico} />} label="Category">{categoryPath.join(' › ')}</Row>
        )}
        {ad.adsRunning > 0 && <Row icon={<TrendingUp className={ico} />} label="Live ads">{formatCount(ad.adsRunning)}</Row>}
        {ad.maxAds7d > 0 && <Row icon={<TrendingUp className={ico} />} label="Peak ads (7d)">{formatCount(ad.maxAds7d)}</Row>}
        {ad.variations > 0 && <Row icon={<Layers className={ico} />} label="Creatives indexed">{formatCount(ad.variations)}</Row>}
      </Section>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {viewer && <AdDrawerNav id={ad.id} drawer={drawer} />}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-foreground/[0.03] px-2.5 py-1 text-xs text-muted-foreground">
          {primaryPlacement} <span aria-hidden>•</span> {ad.mediaType === 'video' ? 'Video' : 'Image'}
        </span>
        <FormatBadge format={ad.format} />
        <div className="ml-auto flex items-center gap-2">
          <ShareButton path={adPath(ad.id)} title={`${ad.advertiser} ad on AdLibrarySpy`} className="h-8 w-8" />
          {ad.linkUrl && (
            <a href={ad.linkUrl} target="_blank" rel="noopener nofollow" title="Open the landing page" aria-label="Open the landing page" className={iconBtn}>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {media && (
            <a href={media} target="_blank" rel="noopener noreferrer" download title="Download media" aria-label="Download media" className={iconBtn}>
              <Download className="h-4 w-4" />
            </a>
          )}
          {viewer
            ? <FavButton type="ad" id={ad.id} initial={!!savedEntry} />
            : <Link href={signupFor(`/ads/${ad.id}`)} title="Sign up free to save this ad" className="btn-ghost h-8 gap-1.5 px-3 text-xs"><Bookmark className="h-3.5 w-3.5" aria-hidden /> Save</Link>}
          <a href={libraryUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary h-8 px-3 text-xs">
            Meta Ad Library <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 scroll-thin md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Preview, laid out like the ad in feed */}
        <div className="self-start rounded-xl border border-border bg-card p-3 md:sticky md:top-0">
          <div className="flex items-center gap-2">
            <BrandLogo logo={ad.storeLogo} domain={ad.domain} name={ad.advertiser} size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{ad.advertiser}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {ad.adsRunning > 0 && <><span className="h-1.5 w-1.5 rounded-full bg-[var(--trend-growth)]" />{formatCount(ad.adsRunning)} active ads</>}
                {ad.country && <span title={countryName(ad.country)}>{flag(ad.country)}</span>}
              </p>
            </div>
          </div>
          <ExpandableCopy text={ad.adCopy} lines={3} className="mt-2" />
          <div className="mt-2 overflow-hidden rounded-lg">
            <CreativeMedia image={ad.image} videoUrl={ad.videoUrl} watchUrl={ad.adLibraryVideoUrl} alt={ad.headline || `Ad by ${ad.advertiser}`}
              className="w-full" autoPlayOnHover={false} />
          </div>
          {(destinationHost || ad.headline) && (
            <div className="mt-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
              {destinationHost && <div className="truncate text-[11px] text-muted-foreground">{destinationHost}</div>}
              {ad.headline && <div className="text-xs font-semibold text-foreground">{ad.headline}</div>}
            </div>
          )}
        </div>

        <DetailTabs tabs={[
          { key: 'ad', label: 'Ads Details', content: adsDetails },
          { key: 'shop', label: 'Shop Details', content: shopDetails },
          ...(saves && boards ? [{
            key: 'boards', label: 'Boards',
            content: <AdBoards adId={ad.id} folders={boards.folders} current={savedEntry ? savedEntry.folderId : undefined} />,
          }] : []),
        ]} />
      </div>
    </div>
  );
}
