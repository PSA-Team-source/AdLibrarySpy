# AdLibrarySpy — Meta signup static image ads (20 concepts)

Twenty different static ads for the Facebook/Instagram **signup** campaign (free, no card).
Every screen crop, product photo, ad creative and number is captured from the live production
app when the script runs. The capture aborts rather than render a missing value.

| File | Format |
|---|---|
| `i01.jpg` … `i20.jpg` | 1080x1350 (4:5, feeds), JPG ≈ q90, each < 1 MB |
| `i01_9x16.jpg` … `i20_9x16.jpg` | 1080x1920 (stories/reels). Key content sits between 14% from the top and 35% from the bottom. The bottom band only holds a faded strip of real imagery. |
| `manifest.json` | per ad: concept, store, primary text (≤ 400), headline (≤ 40), description (≤ 60), and every number shown with the page it came from |
| `contact_4x5.jpg`, `contact_9x16.jpg` | QA contact sheets |

## Rules the ads follow

- Real data only. The ads make no revenue, spend or sales claims, because the product doesn't
  estimate those. Nothing uses invented reviews or social proof, and weak numbers are left out.
- Competitor claims (i03, i19) are only what `https://adlibraryspy.com/vs/trendtrack` states.
  That includes TrendTrack's price tiers, brand caps and seat price, and the check date printed on the ad.
- Founder story (i07, i08) is the launch copy: $300 start, $200/month tools, a free TrendTrack alternative.
- The test account's name, email and workspace never appear, because only element crops are kept. AOV (an
  estimate) is hidden from the Shops table crop.
- If an image is missing, nothing takes its place. A store logo that didn't paint is simply left out.

## Re-render

```bash
# prod DB tunnel on local 15432 (see deploy/README.md), then from _ADLIBRARYSPY:
PLAYWRIGHT=/Users/sangnguyen/fangbot/_FANGBOT/_OPENCLAW-MAIN/node_modules/playwright/index.mjs \
node scripts/render-fb-images.mjs            # capture + render
#   --only=capture | --only=render            # render reuses .work/data.json, no prod access
#   --ids=i01,i07                             # re-render a subset (skips the contact sheets)
```

- `scripts/render-fb-images.mjs` signs in as `shots@marketlens.test` with a 30-minute DB session
  that it revokes at the end. It reads /vs/trendtrack, /weekly, /trending, /shops, six store
  dossiers, /brandtracker, /advertisers and /ads into `.work/` (gitignored).
- `scripts/fb-images-compose.mjs` has the 20 layouts (HTML/CSS screenshotted by Chromium). It fits
  each layout into the format's safe box, checks it landed inside, and writes the manifest and contact sheets.
  It prints a fit scale for each image, and anything below 0.72 is flagged.
