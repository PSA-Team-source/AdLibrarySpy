# AdLibrarySpy — Meta signup video ad

Vertical video ad for the Facebook/Instagram **signup** campaign. Everything on screen is a
crop of the live production app, captured when the script runs. Every number is read from the
page at capture time, and the capture aborts rather than render a missing value.

| File | Format | Length | Size |
|---|---|---|---|
| `als_video_9x16.mp4` | 1080x1920, 30fps, H.264 High + AAC 48k stereo, -14 LUFS | 18.0s | ~11 MB |
| `als_video_4x5.mp4`  | 1080x1350, same story re-laid out for feeds | 18.0s | ~10 MB |
| `thumb_9x16.jpg`, `thumb_4x5.jpg` | the hook frame (t=1.6s) | | |

The two MP4s are gitignored because each is over 10 MB. Re-render them with the command below.

## Storyboard (capture of 2026-09-27, store = comfrt.com)

| Time | Scene | On screen (real data) |
|---|---|---|
| 0.0–2.5 | **Hook** over a scrolling wall of live ad creatives from `/ads` | "This Shopify store is running **3,639** Facebook ads right now" + `comfrt.com` chip. The text is there from frame 0 and the number punches in. |
| 2.5–4.0 | Ads library | "Browse real **Facebook ads**". The creative wall straightens and brightens. |
| 4.0–5.5 | Shop search | "Find the store **behind the ads**". The `/shops` row for comfrt.com pans from the store to 16.1M traffic (ringed) to the 3.6K ads (ringed). |
| 5.5–7.0 | Traffic | "**16.1M** visits a month". Dossier header (Comfrt, Shopify), then a zoom onto Monthly Visits 16.1M +12% (SimilarWeb · Aug 2026). |
| 7.0–8.5 | Live ads | "Their ad count, **every day**". Starts on 3,639 (ringed) and pulls out to the chart, 2.4K to 3.6K. |
| 8.5–10.0 | Products | "Their **best sellers**, ranked". Pans the ranked #1..#6 products with their real prices. |
| 10.0–12.0 | Brandtracker | "Track **every competitor**". Comfrt, Gymshark, Alo Yoga, then zooms onto Comfrt's 3.6K live ads (ringed). |
| 12.0–18.0 | End card | AdLibrarySpy lockup · "The **free** TrendTrack alternative" · Free forever · No credit card · 14.7M stores indexed · **Sign up free →** · adlibraryspy.com |

What is deliberately not in the ad: revenue, spend or sales estimates. The product does not
model them (see the homepage FAQ), so the ad doesn't claim them. The test account's name and
workspace never appear, because only element crops are kept.

Safe zones (9:16): key text sits between 14% from the top and 35% from the bottom. The CTA
button ends at about y=1130 of 1920. On 4:5 there is no overlay UI, so the layout uses the whole
frame.

Audio: a 120 BPM track in A minor (kick, clap, hats, bass, arpeggio, whooshes on the cuts, a
riser and sub impacts). It is synthesized by ffmpeg `aevalsrc` inside the script, with no
samples and no third-party music. Cuts land on the half-beat.

## Re-render

```bash
# 1. DATABASE_URL reachable (the prod DB tunnel on local port 15432, same as capture-landing.mjs)
# 2. capture + render (ffmpeg-static: Homebrew ffmpeg is broken on this Mac)
cd _ADLIBRARYSPY
FFMPEG=<ffmpeg-static binary> \
PLAYWRIGHT=/Users/sangnguyen/fangbot/_FANGBOT/_OPENCLAW-MAIN/node_modules/playwright/index.mjs \
node scripts/render-fb-video.mjs [--store=comfrt.com] [--only=capture|render]
```

- `scripts/render-fb-video.mjs` signs in as `shots@marketlens.test` with a 30-minute DB session
  that it revokes at the end. It captures crops and live numbers into `.work/` (`data.json` holds
  the numbers and where each highlight ring goes).
- `scripts/fb-video-compose.mjs` holds the motion design, one HTML page per format. `renderAt(t)`
  is a pure function of time, so Chromium screenshots each 1/30s and pipes the frames into
  ffmpeg. The same file synthesizes the music.
- `--store=<domain>` re-cuts the whole ad around another store (the hook number, visits and
  crops all follow). `--only=render` re-renders from the last capture without touching production.
- Check afterwards:
  `ffmpeg -ss 3 -i als_video_9x16.mp4 -frames:v 1 f.jpg`

## v2: 20 angle x store creatives (`v2/`)

`v2/v01.mp4` … `v2/v20.mp4` (1080x1920, H.264 High, AAC 48k, 30fps, two-pass at ~3.7 Mbps so each
file is under 9 MB and fits a 10 MB browser upload), `v2/vNN.jpg` thumbnails (the landed hook
frame) and `v2/manifest.json` (ad copy + every number on screen with the page it came from).

| id | store | angle | length | size | hook |
|---|---|---|---|---|---|
| v01 | mellowsleep.com | live-ad-count | 14.5s | 7.0 MB | This Shopify store is running 15,706 Facebook ads right now |
| v02 | resilia.shop | traffic | 14.2s | 6.9 MB | This supplement store gets 9.9M visits a month |
| v03 | emmafy.com | growth | 14.1s | 6.7 MB | This store's traffic grew +156% in one month |
| v04 | frostbuddy.com | best-seller | 13.9s | 6.5 MB | Their #1 product costs $8.99 |
| v05 | comfrt.com | best-seller | 14.0s | 6.6 MB | Comfrt's top product is $49: Minimalist Hoodie – Mega |
| v06 | - | price-vs-trendtrack | 15.6s | 7.5 MB | Stop paying for an ad spy tool |
| v07 | - | brandtracker | 13.4s | 6.5 MB | Spy on your competitors |
| v08 | goda.co | pov-chat | 17.5s | 8.1 MB | POV: you finally check your competitor (goda.co: 3,657 live ads) |
| v09 | wuffes.com | checklist | 14.4s | 6.8 MB | Before you launch a pet product, check the leader |
| v10 | mellowsleep.com | punch | 8.0s | 3.6 MB | One Shopify store. 15,706 Facebook ads live. |
| v11 | resilia.shop | punch | 9.0s | 4.3 MB | This store gets 9.9M visits a month |
| v12 | thefleececompany.com | ad-count-climb | 12.8s | 5.9 MB | Their Facebook ad count doubled in 11 days |
| v13 | lymphoria.co | growth | 11.9s | 5.7 MB | This health store's traffic went +155% in one month |
| v14 | RYZE Superfoods | top-advertiser | 12.7s | 6.0 MB | One brand is running 20,360 Facebook ads |
| v15 | - | fastest-growing | 11.1s | 5.2 MB | The top store this month grew +984% in visits |
| v16 | jwpei.com | live-ad-count | 13.6s | 6.5 MB | A handbag brand running 5,192 Facebook ads |
| v17 | - | free-checklist | 15.0s | 7.0 MB | What you get for $0 |
| v18 | comfrt.com | search-lookup | 16.8s | 7.9 MB | Look up any Shopify store (comfrt.com: 16.1M visits, 3,639 live ads) |
| v19 | tryrovina.com | traffic-growth | 13.7s | 6.3 MB | tryrovina.com, this month: 2.2M visits, +102%, 2,911 ads |
| v20 | gymshark.com | punch | 10.0s | 4.7 MB | Gymshark gets 15.8M visits a month |

Angles: live ad count, traffic, growth (SimilarWeb month over month), best seller (#1 ranked
product + price), ad count climbing (drawn from the chart's own daily points), price vs
TrendTrack (only the $49/$89/$159, lookup, brand and seat figures printed on `/vs/trendtrack`),
Brandtracker, top advertiser, fastest-growing stores (`/trends`), POV chat, search lookup,
checklist/tally, and 8-10s punch cuts. Each video has its own accent colour, hook layout
(center / left italic / outline fill / stacked block / words), transition (up / whip / zoom),
end card (lockup / lime-inverted / left split) and track (tempo 96-128 BPM, key, progression,
four-on-the-floor or half-time groove, arpeggio order).

Rules the engine enforces: a spec throws on a missing figure, on a traffic decline (growth
angles), on a falling ad count ("climbing" angles) and on a best-seller list that isn't ranked;
"doubled" is only printed when the last point is at least twice the first. Before encoding,
each scene is checked with every key text element between 14% from the top and 35% from the
bottom of the frame, which also holds under Meta's 4:5 feed crop. Copy is capped at 400/40/60
characters. No revenue or spend figure appears anywhere.

```bash
cd _ADLIBRARYSPY
# prod DB tunnel on 15432 (as for capture-landing.mjs):
#   ssh -f -N -i <v3-220 pem> -o IdentitiesOnly=yes -L 15432:<rds host>:5432 ubuntu@<app host>
FFMPEG=<ffmpeg-static> PLAYWRIGHT=<playwright/index.mjs> \
node scripts/fb-video-v2.mjs [--only=capture|render] [--ids=v01,v05] [--fresh]
```

- `scripts/fb-video-v2.mjs` captures 12 stores + shared pages into `v2/.work/cap/` (one 30-minute
  session per batch of four, each revoked at the end; a store already captured is kept unless
  `--fresh`), then renders.
- `scripts/fb-video-angles.mjs` holds the 20 specs (`VIDEOS`), scene kinds, music and encoder.
  Each video renders in its own `v2/.work/vNN/`.
- `scripts/fb-video-prod.mjs` is the signed-in capture session shared with the first ad.
- Numbers are live: re-capturing changes them (and the manifest copy follows).

## Sources

- Store data: `https://adlibraryspy.com/shops?q=comfrt.com` and the shop dossier. Traffic is
  measured by SimilarWeb (Aug 2026) and live Meta ads come from the Meta Ad Library, as the app
  labels them.
- Ad creatives: first pages of `https://adlibraryspy.com/ads` (public Meta Ad Library ads).
- Brandtracker: the screenshots workspace's tracked brands (Comfrt, Gymshark, Alo Yoga, SKIMS).
- Brand: lime `#a7f45a` on ink `#050807`, the target mark (`components/brand/brand-mark.tsx`),
  Inter. These are the same as the homepage.

## Homepage product tour (`--set=home`)

The looping video in the homepage hero is the same engine in a landscape format (`HOME` in
`scripts/fb-video-angles.mjs`): 1920x1080 compose, caption column left, real crops right, no music
and no end card (the page has its own signup). The last scene hands back to the first and the
file starts on its poster frame, so the loop and the poster -> play swap are both seamless.

| Time | Scene | On screen (capture of 2026-09-27, comfrt.com) |
|---|---|---|
| 0-2.5 | Hook over the live ad wall | "Spy on **any** Shopify store" · Live Meta ads · SimilarWeb traffic · best sellers |
| 2.5-4.5 | Ads library | "Browse **live** Facebook ads" |
| 4.5-7 | Shop search | comfrt.com's `/shops` row, panned to its 3.6K ads (ringed) |
| 7-9.5 | Traffic | "**10.8M → 16.1M** visits a month" over the dossier's Traffic Over Time (SimilarWeb, Jun → Aug) |
| 9.5-12 | Best sellers | the ranked #1..#4 products with prices |
| 12-14.5 | Live Meta ads | "**2.4K → 3.6K** ads in 9 days", drawn from the chart's own daily points |
| 14.5-17 | Brandtracker | Comfrt, Gymshark, Alo Yoga, SKIMS; Comfrt's live ads ringed |
| 17-19.5 | Close | "**14.7M** stores. **100%** free." · adlibraryspy.com |

Output goes straight to `public/landing/` under a dated name (the edge keeps `/landing/*` for 30
days, so a new render gets a new name and `app/page.tsx` points at it): `tour-<date>.{webm,mp4}`
1600x900 (budget 1.9 / 2.45 MB), `tour-<date>-m.{webm,mp4}` 960x540 for phones (0.9 / 1.15 MB,
picked by `<source media>`), `tour-<date>.webp` poster. H.264 High + VP9, two-pass, no audio
track. `marketing/fb-video/homepage.json` lists every number with its source page.

```bash
FFMPEG=<ffmpeg-static> PLAYWRIGHT=<playwright/index.mjs> \
node scripts/fb-video-v2.mjs --set=home [--only=capture|render] [--fresh]
# then rename web.name in HOME + the four <source>s/poster in app/page.tsx, deploy, purge /landing/*
```
