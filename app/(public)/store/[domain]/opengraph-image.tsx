import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getShop } from '@/lib/data';
import { storeProfile } from '@/lib/market/storefront';
import { compact } from '@/lib/format';
import { monthLabel } from '@/lib/traffic/similarweb';
import { measuredVisits, publicDomain } from '@/lib/public/site';
import { MUTED, OG_HEADERS, OG_SIZE, OgFrame, OgLockup, OgStat, clipText, imageData, ogFonts } from '@/lib/public/og';

export const alt = 'Shop profile on AdLibrarySpy: traffic, live Meta ads and niche';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

/** Share card for /store/{domain}: real figures only; a missing one is a missing tile. */
export default async function StoreOgImage({ params }: { params: Promise<{ domain: string }> }) {
  const domain = publicDomain((await params).domain);
  const shop = domain ? await getShop(domain).catch(() => null) : null;
  if (!shop) notFound();

  const [profile, logo, fonts] = await Promise.all([
    storeProfile(shop.storeId),
    // The favicon service answers any domain; only a real (>16px) mark is worth drawing.
    imageData(shop.logo && !/\.ico(\?|$)/i.test(shop.logo) ? shop.logo : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(shop.domain)}&sz=128`, { minPx: 32 }),
    ogFonts(),
  ]);
  const visits = measuredVisits(shop);
  const period = shop.similarweb?.period ?? '';
  const niche = (profile?.categoryPath.length ? profile.categoryPath : shop.niches).at(-1) ?? '';

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <OgLockup />
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>Shop profile</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 64 }}>
          {logo && <img src={logo} width={112} height={112} style={{ borderRadius: 24, background: '#fff', objectFit: 'contain' }} alt="" />}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1.5 }}>{clipText(shop.name, 28)}</div>
            <div style={{ display: 'flex', fontSize: 32, color: MUTED, marginTop: 10 }}>{clipText(shop.domain, 48)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 'auto' }}>
          {visits > 0 && <OgStat label="Monthly visits" value={compact(visits)} note={period ? `SimilarWeb · ${monthLabel(period)}` : 'SimilarWeb'} />}
          {shop.metaAds > 0 && <OgStat label="Live Meta ads" value={shop.metaAds.toLocaleString('en-US')} />}
          {niche && <OgStat label="Niche" value={clipText(niche, 22)} />}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts, headers: OG_HEADERS },
  );
}
