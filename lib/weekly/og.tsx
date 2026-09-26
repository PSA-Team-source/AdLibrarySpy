// Share card for a weekly report: the week's top three scaling stores with
// their real figures. Built on the public share-card kit (lib/public/og.tsx).
import { ImageResponse } from 'next/og';
import type { WeeklyReport } from './types';
import { LINE, MUTED, OG_HEADERS, OG_SIZE, OgFrame, OgLockup, clipText, ogFonts } from '@/lib/public/og';

export async function weeklyOgImage(report: WeeklyReport): Promise<ImageResponse> {
  const d = report.data;
  const scaling = d.sections.find(s => s.key === 'scaling') ?? d.sections[0];
  const top = scaling?.items.slice(0, 3) ?? [];
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <OgLockup />
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>The Monday report</div>
        </div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 600, letterSpacing: -1.2, marginTop: 44 }}>{d.weekLabel}</div>
        {scaling && <div style={{ display: 'flex', fontSize: 28, color: MUTED, marginTop: 6 }}>{scaling.title}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          {top.map((it, i) => (
            <div key={it.domain} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 22px', border: `1px solid ${LINE}`, borderRadius: 16, background: 'rgba(255,255,255,.04)' }}>
              <div style={{ display: 'flex', fontSize: 28, color: MUTED, width: 28 }}>{i + 1}</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', fontSize: 32, fontWeight: 600 }}>{clipText(it.name, 34)}</div>
                <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>{clipText(it.domain, 48)}</div>
              </div>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 600 }}>{it.metric}</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts, headers: OG_HEADERS },
  );
}
