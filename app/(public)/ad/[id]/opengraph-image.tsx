import { ImageResponse } from 'next/og';
import { notFound, redirect } from 'next/navigation';
import { getAd } from '@/lib/data';
import { dateShort } from '@/lib/format';
import { MUTED, OG_HEADERS, OG_SIZE, OgFrame, OgLockup, clipText, imageData, ogFonts } from '@/lib/public/og';

export const alt = 'Meta ad on AdLibrarySpy: creative, brand and headline';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

/** Share card for /ad/{id}: the creative itself beside the brand and headline. */
export default async function AdOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) notFound();
  const ad = await getAd(id).catch(() => null);
  // An ad that left the index still gets a card where the link was shared: the site's own.
  if (!ad) redirect('/opengraph-image.jpg');

  const [creative, logo, fonts] = await Promise.all([
    imageData(ad.image, { timeoutMs: 4000 }),
    ad.storeLogo && !/\.ico(\?|$)/i.test(ad.storeLogo)
      ? imageData(ad.storeLogo)
      : ad.domain ? imageData(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(ad.domain)}&sz=128`, { minPx: 32 }) : Promise.resolve(''),
    ogFonts(),
  ]);
  const meta = [
    `Meta · ${ad.mediaType === 'video' ? 'Video ad' : 'Image ad'}`,
    ad.startDate && dateShort(ad.startDate) && `since ${dateShort(ad.startDate)}`,
    ad.daysRunning > 0 && `${ad.daysRunning} days running`,
  ].filter(Boolean).join(' · ');

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', flex: 1, gap: 48, minHeight: 0 }}>
          {creative && (
            <img src={creative} width={414} height={518} alt=""
              style={{ width: 414, height: 518, objectFit: 'cover', borderRadius: 22, border: '1px solid rgba(255,255,255,.12)' }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <OgLockup />
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 56 }}>
              {logo && <img src={logo} width={72} height={72} style={{ borderRadius: 16, background: '#fff', objectFit: 'contain' }} alt="" />}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>{clipText(ad.advertiser, 26)}</div>
                {ad.domain && ad.domain !== ad.advertiser && <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>{clipText(ad.domain, 40)}</div>}
              </div>
            </div>
            {ad.headline && (
              <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.2, fontWeight: 600, marginTop: 40 }}>
                “{clipText(ad.headline, creative ? 90 : 140)}”
              </div>
            )}
            <div style={{ display: 'flex', marginTop: 'auto', fontSize: 24, color: MUTED }}>{meta}</div>
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts, headers: OG_HEADERS },
  );
}
