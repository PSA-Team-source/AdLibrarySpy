# Architecture

How the AdLibrarySpy web app is put together. For setup, see the [README](../README.md#run-it-yourself).

## Layout

```
app/(auth)/*      sign in, sign up, reset, verify, accept invite
app/(app)/*       the product — every page behind requireCtx()
app/(public)/*    anonymous, edge-cached pages: /store/{domain}, /stores, /trending, /weekly
app/api/public/*  anonymous JSON (store card, weekly report) used by the extension, CLI and MCP
app/api/export/*  signed-in CSV downloads of /shops and /ads (same loaders, lib/csv.ts)
app/api/mcp       MCP server (JSON-RPC 2.0, OAuth 2.1 bearer)
app/oauth/*       consent screen; app/api/oauth/* token + registration
lib/market/*      index client, service token, shop and creative mappers
lib/traffic/*     SimilarWeb mapping + labels, CrUX ranks, licensed-provider cache
lib/auth/*        passwordless sign-in (emailed code + magic link, Google ID token), sessions, request guards
lib/migrations/   SQL, applied in filename order by npm run migrate
packages/*        shopify-inspect (CLI) and adlibraryspy-mcp (stdio MCP), npm workspaces
extension/        Chrome extension (Manifest V3, activeTab only)
leaderboard/      the weekly README table and its GitHub Action
scripts/          migrations runner, snapshot, alerts-digest + weekly-report jobs
```

Multi-tenancy is enforced in `lib/auth/guard.ts`: a `workspace_id` is always
resolved from the session, never accepted from a request.

## CSV exports

`GET /api/export/shops` and `GET /api/export/ads` take exactly the query string of
`/shops` and `/ads` and run it through the screen's own loader (`app/(app)/shops/load.ts`,
`lib/market/ads-params.ts`), so a file always holds the rows on screen, in the same sort,
from row 1 up to `EXPORT_MAX_ROWS` (1,000). Each call spends one hit from `FAIR_USE.export`
in `lib/ratelimit.ts` (10 a minute, 50 a day per user, 100 a day per IP) and writes an
`export.shops` / `export.ads` audit row. `lib/csv.ts` writes RFC 4180 with a UTF-8 BOM and
prefixes text starting with `= + - @` with `'` so a cell never runs as a spreadsheet formula;
the workspace audit export uses the same writer. A cell the table leaves blank (traffic that
fails the credibility check, an unmeasured 7-day peak) is blank in the file too.

## Alerts

`scripts/alerts-digest.mjs` runs daily at 13:00 UTC (9:00 ET; retries 14:30 and 16:00,
`deploy/crontab.txt`) and mails each user one digest per period, **daily by default**
(owner decision 2026-09-27; migration 018), weekly on Mondays, or off:

- **Brandtracker changes** for every workspace the user belongs to: the board's own window
  delta (`trackerBoard` in `lib/trackers.ts`, `1d` for daily, `7d` for weekly), reported
  only when material (`trackerLines` in `lib/alerts/digest.ts`: new ads, a live-ad change,
  monthly visits moving 10%+ with the same measurement source, product-count change).
- **Saved searches** (`saved_searches`, personal per workspace + user, saved from the
  **Save search** button on `/shops` and `/ads`, managed at `/searches`): page 1 is re-run
  through `loadShops` / `queryAds(adFilterFromParams(...))`, the pages' own loaders
  (`scripts/ts-paths.mjs` lets the job import them). A new alert is seeded with the current
  results first; afterwards only ids never shown before are mailed.
- **Today in the market** (`lib/alerts/market.ts`), after the personal sections: Shopify
  stores whose running Meta ads rose 100+ from the day before to yesterday, from ClickHouse
  `market_research.market__daily_summary_stores` (the crawler's daily running-ads count, the
  only store metric that moves daily; SimilarWeb is monthly and is not used). In the user's
  top niche (from the stores they track and save) when it has 3+ movers, else overall; fewer
  than 3 movers and the section is left out. Logos only when they are https raster images.

No personal news and no market section = no email that day. A `(user, period)` row in
`alert_sends` is claimed before sending, so retries never double-send; a failed send drops
its claim. If the market section or a user's search cannot be computed after retries, the
run (or that user) waits for the next run — never a partial digest. Addresses on reserved
TLDs (`.test`, `.example`) are skipped. Sends are paced (`ALERTS_SEND_GAP_MS`, 3 s).

**Marketing envelope.** The digest goes through `sendMarketingMail` (`lib/mail.ts`) with
envelope sender `mkt-bounce.no-reply@adlibraryspy.com` (a Stalwart alias of the no-reply
mailbox), which Stalwart routes to the marketing IP `167.233.188.42` under the warm-up
stages (DTCMail `infra/runbooks/IP-WARMUP.md` §9). It tries `mkt-bounce.no-reply@news.…`
first (§10, not set up for adlibraryspy.com yet), and a refused envelope falls back to the
next and finally to the mailbox itself, remembered 10 min — mail is never dropped. From is
unchanged. Sign-in and invite mail stay on `sendMail` (mailbox envelope, transactional IP).

One-click unsubscribe (`List-Unsubscribe` + RFC 8058) is the newsletter's signed link with
`l=alerts` (`lib/weekly/unsubscribe.ts`, its own HMAC purpose).
`--dry-run [--as-monday] [--only=<email>] [--render=<dir>] [--day=YYYY-MM-DD]` computes from
live data and writes nothing; `--only=<email> --send-to=<addr>` mails one digest elsewhere.

## AI creative labels

Each creative's ad text is classified by a text classifier; the index's creatives
endpoints return the result as `ai_labels` and serve label counts from
`/creatives-es/label-facets`. `lib/market/labels.ts` maps both.

- **They are model judgments with a confidence, not measurements.** Every
  surface says so: the `/ads` filter row, the ad's "Creative breakdown" block
  and the shop's "Creative mix" section.
- **A label the model was unsure of is absent**, and absence renders nothing.
  An unlabeled ad has no breakdown block and no hook chip.
- **Filters are built from the facets.** `/ads` shows hook / angle / funnel
  stage / offer / urgency filters only when the current search has labeled
  creatives, with the options and counts the index returned. They are applied
  server-side (`hook`, `angle`, `funnelStage`, `offer`, `urgency` params), so
  unlabeled creatives drop out of a filtered search.
- **Shares are of labeled creatives**, not of all creatives: a brand's
  "Creative mix" divides each count by `labeled`, and is omitted when that is 0.

## Traffic

`lib/traffic/similarweb.ts` reads the platform's own SimilarWeb site-overview
crawl, which measures the **exact store host**. Brand rows carry `sw_visits`,
`sw_growth_pct`, `sw_period` and the global/country/category ranks;
`/top-brands/{id}` adds `similarweb_detail` — up to three measured months,
engagement, the traffic-source mix, top countries and top keywords. Shops are
ranked by `sw_visits` (`SHOP_SORTS.traffic`; the table opens on `max_ads_7d`) and
by `sw_growth_pct` (`SHOP_SORTS.growth` and the *Fastest growing* segment). Both
sorts keep a second key — `monthly_traffic` and `growth_rate` — underneath, with
`missing: "_last"` in both directions, so a store the crawl has not reached
holds its old relative position instead of dropping out of a list.

The index's own `monthly_traffic` is the **parent** domain's figure —
store.nytimes.com was filed with nytimes.com's 178M visits — and its
`similar_web` rank is a ~12.1M sentinel for every subdomain storefront. It
survives only as a fallback for stores the crawl has not reached yet, always
captioned *Market index estimate*, and `trafficIsCredible()`
(`lib/traffic/crux.ts`) still withholds it where Chrome's own ranking
contradicts it. Growth follows the visit figure's source by construction: a
measured store shows SimilarWeb's month-over-month change or, with only one
measured month, nothing at all — never the index's rate beside a measured
figure. A measured SimilarWeb figure is never gated by that test — the
contradiction it catches is exactly what the crawl fixes. `Shop.trafficSource`
says which of the two any figure is, on every surface and in the MCP tools.

## Winning products

`/products` (and `search_products` over MCP) lists storefront products that Meta
ads land on. The Go API (`GET /market/winning-products`,
`backend-v3-go/internal/port/httpapi/market_winning_products.go`) builds it in
the background: ClickHouse groups every creative whose landing URL is
`<host>/products/<handle>` (active ads, ads started in the last 14 days,
advertiser pages, first-ad date, up to six ads with hosted media), the Shops
index supplies the store (traffic, niche, dossier id), and the storefront's own
`/meta.json` + `/products/<handle>.js` supply title, image and price in the
shop's currency (cached 24h). A product whose storefront never described it is
not listed. The market product index is not used: its `num_ads` is the store's
total copied onto every product, `sales_score` is 0 everywhere and its currency
is "USD" even for stores pricing in other currencies. `app/(app)/products/load.ts`
is shared by the page's first render and `GET /api/products`.

The shop dossier's Products panel shows the whole published catalogue with
prices (`/products.json`, 48 a page; `GET /api/shops/products` serves the pages
after the first).

Every other Shops surface (the table, `/stores`, store cards, the dossier's
first paint) reads the thumbnails from the index's `news_products`. The Go job
`market_products_sync` (`backend-v3-go/internal/services/marketproducts`) fills
it for Shopify stores from their own `/products.json`, busiest first, with the
count from `/meta.json` where the index has none. One read per store per 30
days (cache `market.store_products`); reads are paced at a self-tuned rate that
halves when Shopify starts returning 429s, because the API box's live dossier
reads share its egress IP.

## Licensed traffic

`lib/traffic/provider.ts` implements SimilarWeb and Semrush. Set
`TRAFFIC_PROVIDER=similarweb` and `SIMILARWEB_API_KEY`, and monthly history is
fetched, cached in `traffic_monthly`, and used in place of the index value.
Without a key — the production case — `monthlyTraffic()` returns `null` for
every domain. It never fabricates a series, and it is skipped entirely for a
store the platform's own crawl has already measured.

## MCP server

Server URL: `https://<host>/api/mcp`. Discovery is at
`/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource`; clients register themselves via RFC 7591
and authorize with PKCE (S256 required). 12 tools across three scopes — see
`lib/mcp/tools.ts`. Only tools with a real query behind them are declared.

`search_ads` filters by AI label (`hook`, `angle`, `funnelStage`, `offer`,
`urgency`) and returns each ad's `labels`; `get_ad` returns them too;
`creative_breakdown` returns a store's label counts (`total`, `labeled`, and
per-label `facets`). All three tell the assistant the labels are model
classifications of ad text with a confidence, absent when uncertain, and that
absence is not evidence of anything.

The stdio companion (`packages/mcp`) and its tool list are documented in [mcp.md](mcp.md).
