# AdLibrarySpy vs TrendTrack — X ad (16:9, 20s)

Hook: TrendTrack 2,141,762 stores (struck out) → AdLibrarySpy 14.7M (6.9×) → bar race → Resilia face-off
(TrendTrack shows 2,477 Meta ads, AdLibrarySpy tracks 8,787 live = 3.5×) → $159/mo vs $0 → end card.

Sources: TrendTrack Shops count + Resilia "Meta Ads (2477)" tab from their app, captured 2026-09-23
(`research/tt-2026-09-23/REFERENCE.md`); AdLibrarySpy 14.7M from /vs/trendtrack and 8,787 from
/store/resilia.shop, checked 2026-10-02. Ad crops = real Resilia ads + /ads wall from `v2/.work/cap`.

Re-render: `FFMPEG=<ffmpeg-static> node render.mjs` (or `node render.mjs 3 11.5` for stills). Music is synthesized.

## Apple cut (default) — `adlibraryspy-vs-trendtrack-apple.mp4`, 22s, 1080p60
Matches the PlatformDTC "new look" X video: navy→violet field, live adlibraryspy.com screens (captured by
`cap.mjs` into `scr/`) floating in 3D, one short SF line per beat, tilted screen wall + lockup.
Beats: "Every Shopify store." → TrendTrack 2,141,762 struck → "We see 14.7M" → Resilia store page →
2,477 vs 8,787 → "$159 a month. Or $0. Forever." → "AdLibrarySpy. The whole market. Free."
Render: `FFMPEG=<ffmpeg-static> node render.mjs` (Apple cut) · `CUT=v1 node render.mjs` (first cut).
