import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { LINE, LIME, MUTED, OG_HEADERS, OG_SIZE, OgFrame, OgLockup, clipText, ogFonts } from '@/lib/public/og';
import { monthLabel } from '@/lib/traffic/similarweb';
import { NICHE_MIN_GROWTH } from '@/lib/trends';
import { loadNicheTrends } from '@/app/(app)/trends/load';

// Share card for /trending: the month's top three breakout niches with their
// real share of stores growing 50%+ (SimilarWeb). No data = no card (404).
export const alt = 'Trending Shopify niches this month, measured by SimilarWeb — AdLibrarySpy';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function TrendingOgImage() {
  const data = await loadNicheTrends().catch(() => null);
  const top = data?.niches.slice(0, 3) ?? [];
  if (top.length < 3) notFound();
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <OgLockup />
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>{monthLabel(data!.period)} · SimilarWeb</div>
        </div>
        <div style={{ display: 'flex', fontSize: 58, fontWeight: 600, letterSpacing: -1.2, marginTop: 40 }}>Shopify niches breaking out</div>
        <div style={{ display: 'flex', fontSize: 26, color: MUTED, marginTop: 6 }}>Share of each niche&apos;s stores that grew {NICHE_MIN_GROWTH}%+ this month</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          {top.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 22px', border: `1px solid ${LINE}`, borderRadius: 16, background: 'rgba(255,255,255,.04)' }}>
              <div style={{ display: 'flex', fontSize: 28, color: MUTED, width: 28 }}>{i + 1}</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', fontSize: 32, fontWeight: 600 }}>{clipText(n.name, 34)}</div>
                <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>{n.breakout.toLocaleString('en-US')} of {n.measured.toLocaleString('en-US')} stores · {clipText(n.parentName, 30)}</div>
              </div>
              <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, color: LIME }}>{Math.round(n.share * 100)}%</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts, headers: OG_HEADERS },
  );
}
