<div align="center">

# AdLibrarySpy

**Open-source Shopify store and ad intelligence: the full [adlibraryspy.com](https://adlibraryspy.com/?ref=gh:readme) web app, a CLI, an MCP server for AI assistants, a Chrome extension and a weekly leaderboard.**

See any store's best sellers, apps, traffic and live Meta ads, or ask Claude which stores are scaling this week.
Every number carries its source. Nothing is estimated.

[![CI](https://github.com/PSA-Team-source/AdLibrarySpy/actions/workflows/ci.yml/badge.svg)](https://github.com/PSA-Team-source/AdLibrarySpy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node 18+](https://img.shields.io/badge/node-%E2%89%A518-43853d)

[Quick start](#quick-start) · [The web app](#the-web-app) · [MCP for Claude & Cursor](#ask-your-ai-assistant) · [This week's leaderboard](#this-weeks-shopify-breakouts) · [Data honesty](docs/data-honesty.md) · [adlibraryspy.com](https://adlibraryspy.com/?ref=gh:readme)

<img src=".github/assets/shopify-inspect.gif" alt="npx shopify-inspect deathwishcoffee.com prints the store's theme, prices, measured traffic, live Meta ads, apps, best sellers and newest products" width="760">

</div>

## Quick start

```bash
npx shopify-inspect allbirds.com
```

You don't need to sign up or have a key, and nothing gets installed. You get the store's theme, currency, product count, price range,
**best sellers and newest products in the store's own order**, the apps and pixels it runs (Klaviyo, Judge.me, Recharge,
Meta Pixel, TikTok…), and, when the store is in the index, its **measured monthly traffic and live Meta ad count**.

```bash
npx shopify-inspect gymshark.com skims.com --json   # compare stores, pipe into anything
```

## Ask your AI assistant

```bash
claude mcp add adlibraryspy -- npx -y adlibraryspy-mcp
```

Then ask:

> *"Which Shopify stores grew fastest this week? Group them by niche and show what they sell."*
>
> *"Inspect deathwishcoffee.com. What are its best sellers, and which apps does it run?"*
>
> *"Find coffee stores running Meta ads and break down the hooks and offers in their creatives."*

Three tools work with no account. Add a free key from [adlibraryspy.com/settings/api](https://adlibraryspy.com/settings/api?ref=gh:readme)
to search the full index of stores and ad creatives, with AI labels for each creative's hook, angle, offer and funnel stage.
The server works with **Claude, Claude Code, Cursor, VS Code** and any other MCP client, or you can paste
`https://adlibraryspy.com/api/mcp` into Claude → Settings → Connectors. → **[Setup for every client](docs/mcp.md)**

## What's in this repo

| | |
|---|---|
| [`app/`](app), [`lib/`](lib), [`components/`](components) | The **adlibraryspy.com web app** (Next.js 15, React 19, Postgres): store and ad explorer, store dossiers, brandtracker, AI creative labels, weekly report, public SEO pages, and the hosted MCP server with OAuth 2.1. |
| [`packages/shopify-inspect`](packages/shopify-inspect) | CLI + library. Reads a store's own storefront (`/meta.json`, collection order, `/products.json`) and detects 40+ apps and pixels. Zero dependencies. |
| [`packages/mcp`](packages/mcp) | `adlibraryspy-mcp`, a stdio MCP server. Keyless tools plus a proxy to the hosted index. |
| [`extension`](extension) | Chrome extension: click on any Shopify store to see traffic, ads, top products and apps. `activeTab` only, nothing runs in the background. |
| [`leaderboard`](leaderboard) | A GitHub Action that rewrites the table below every week from the public report. Every past week is [archived](leaderboard/weekly/). |

## This week's Shopify breakouts

<!-- leaderboard:start -->
**Week 39, 2026** · updated 2026-09-25 · [full week](leaderboard/weekly/2026-w39.md) · [all weeks](leaderboard/weekly/)

### Top scaling stores

<sub>Stores adding the most ads in the Meta Ad Library, with measured traffic behind them. Source: Change in running ads in the Meta Ad Library, AdLibrarySpy index (Sep 2026 snapshot). Traffic: SimilarWeb, Aug 2026.</sub>

| # | Store | Niche | | Change | Measured |
|--:|---|---|:-:|--:|---|
| 1 | [SM Appliance](https://adlibraryspy.com/store/smappliance.com) | Home & Garden | 🇵🇭 | **+251 ads** | 344 ads running in the Meta Ad Library (+69%) · 309K visits in Aug 2026 (SimilarWeb) |
| 2 | [Power Crunch](https://adlibraryspy.com/store/powercrunch.com) | Health | 🇺🇸 | **+115 ads** | 114 ads running in the Meta Ad Library · 33K visits in Aug 2026 (SimilarWeb) |
| 3 | [Roosty's](https://adlibraryspy.com/store/roostys.co) | Food & Drink | 🇺🇸 | **+78 ads** | 99 ads running in the Meta Ad Library (+49%) · 110K visits in Aug 2026 (SimilarWeb) |
| 4 | [Official EA Site](https://adlibraryspy.com/store/ea.com) | Games | 🇺🇸 | **+68 ads** | 137 ads running in the Meta Ad Library · 77M visits in Aug 2026 (SimilarWeb) |
| 5 | [AntiSocialSocialClub](https://adlibraryspy.com/store/antisocialsocialclub.com) | Apparel | 🇺🇸 | **+68 ads** | 154 ads running in the Meta Ad Library (+425%) · 183K visits in Aug 2026 (SimilarWeb) |
| 6 | [Official Sun Bum® Website](https://adlibraryspy.com/store/sunbum.com) | Beauty & Fitness | 🇺🇸 | **+66 ads** | 253 ads running in the Meta Ad Library · 201K visits in Aug 2026 (SimilarWeb) |
| 7 | [Kardia](https://adlibraryspy.com/store/kardia.com) | Health |  | **+61 ads** | 151 ads running in the Meta Ad Library (+203%) · 172K visits in Aug 2026 (SimilarWeb) |
| 8 | [MeUndies®](https://adlibraryspy.com/store/meundies.com) | Apparel | 🇺🇸 | **+60 ads** | 541 ads running in the Meta Ad Library (+35%) · 1.8M visits in Aug 2026 (SimilarWeb) |
| 9 | [SYLVOX](https://adlibraryspy.com/store/sylvoxtv.com) | Consumer Electronics | 🇺🇸 | **+57 ads** | 109 ads running in the Meta Ad Library (+172%) · 185K visits in Aug 2026 (SimilarWeb) |
| 10 | [LSKD](https://adlibraryspy.com/store/lskd.co) | Apparel | 🇦🇺 | **+44 ads** | 69 ads running in the Meta Ad Library (+733%) · 2M visits in Aug 2026 (SimilarWeb) |

### Fastest traffic growth

<sub>Largest month-over-month jump in measured visits, among stores that already had 20K+ visits. Source: SimilarWeb measured visits, Jul 2026 → Aug 2026.</sub>

| # | Store | Niche | | Change | Measured |
|--:|---|---|:-:|--:|---|
| 1 | [StancedCo](https://adlibraryspy.com/store/stanced.co) | Apparel | 🇺🇸 | **+1,522%** | 29K → 474K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 2 | [Starlite](https://adlibraryspy.com/store/starlite.com.gh) | Computers | 🇬🇭 | **+1,519%** | 85K → 1.4M visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 3 | [Starlink Online](https://adlibraryspy.com/store/starlink.qa) | Computers | 🇶🇦 | **+1,503%** | 55K → 883K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 4 | [Absolute Eclipse](https://adlibraryspy.com/store/absoluteeclipse.eu) | Apparel | 🇱🇻 | **+1,475%** | 77K → 1.2M visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 5 | [CompuGhana](https://adlibraryspy.com/store/compughana.com) | Home & Garden | 🇬🇭 | **+1,410%** | 85K → 1.3M visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 6 | [Solar Eclipse Eyewear](https://adlibraryspy.com/store/helioclipse.com) | Health | 🇺🇸 | **+1,399%** | 52K → 784K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 7 | [Deli Hemp](https://adlibraryspy.com/store/delihemp.com) | Food & Drink | 🇫🇷 | **+1,204%** | 29K → 373K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 8 | [Primal Storm](https://adlibraryspy.com/store/primal-storm.com) | Health | 🇺🇸 | **+1,014%** | 59K → 659K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 9 | [Dogshood](https://adlibraryspy.com/store/dogshood.com) | Pets & Animals | 🇩🇪 | **+981%** | 36K → 385K visits, Jul 2026 → Aug 2026 (SimilarWeb) |
| 10 | [RADER SHOP](https://adlibraryspy.com/store/rader-shop.com) | Food & Drink | 🇯🇵 | **+967%** | 22K → 236K visits, Jul 2026 → Aug 2026 (SimilarWeb) |

<!-- leaderboard:end -->

## Why trust these numbers

Most store-spy tools draw a smooth traffic line through two data points and present it as a measurement.
We don't. A figure appears only when something measured it, and it carries its source and month, for example *SimilarWeb · Aug 2026*.
A missing value is `null` and renders as nothing, never as `0` or a guess. AI labels come with their confidence.
[Read the rules →](docs/data-honesty.md)

## The web app

This is the complete source of [adlibraryspy.com](https://adlibraryspy.com/?ref=gh:readme), exactly as it runs in production.

### What it is

Sign-up, workspaces, roles, a live
shop/ad explorer, a brandtracker that records real snapshots, AI creative
labels (hook / angle / funnel stage / offer / urgency), and an MCP server so
Claude or ChatGPT can query the index directly.

#### AI creative labels

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

### Everything is free

Since 2026-09-19 every feature is open to every workspace: no plans, no
limits, no metered credits, no checkout. Abuse protection is the per-workspace
rate limit (`lib/ratelimit.ts`), not a paywall. The `plans`, `subscriptions`,
`credit_*` and `invoices` tables remain in the database but nothing reads them.

### Configuration

All variables are listed, with placeholders, in [`.env.example`](.env.example).

| Variable | Required | Effect when unset |
|---|---|---|
| `DATABASE_URL` | yes | App cannot start; `/api/health` returns 503 |
| `PGSSL` | no | TLS on; set `off` for a local Postgres without TLS |
| `PG_POOL_MAX` | no | Defaults to 10 connections |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | yes | Sign-in is an emailed magic link: nobody can sign in, and invites cannot send |
| `APP_BASE_URL` | yes in production | Links in mail and OAuth metadata point at `http://localhost:4311` |
| `SESSION_SECRET` | for the newsletter | At least 16 characters; without it unsubscribe links cannot be signed |
| `MARKET_API_BASE` | no | Defaults to the public index, `https://api.platformdtc.com/api/v1` |
| `MARKET_TIMEOUT_MS` | no | Defaults to 12000 |
| `PLATFORM_JWT_SECRET`, `MARKET_SERVICE_ACCOUNT_ID`, `MARKET_SERVICE_EMAIL` | for ad creatives and MCP | Service account issued by the index operator; without it ad creatives return empty (shops still work) |
| `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | no | Funnel events are not recorded |
| `TRAFFIC_PROVIDER` + `SIMILARWEB_API_KEY` / `SEMRUSH_API_KEY`, `TRAFFIC_CACHE_DAYS` | no | Traffic comes only from the index's SimilarWeb crawl (see below) |
| `NEXT_PUBLIC_CHROME_EXTENSION_URL` | no | The homepage shows no extension link |
| `APP_VERSION` | no | `/api/health` reports `dev` |
| `WEEKLY_MAIL_PER_SEC` | no | Weekly report sends 4 emails per second |

#### Traffic

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

#### Licensed traffic

`lib/traffic/provider.ts` implements SimilarWeb and Semrush. Set
`TRAFFIC_PROVIDER=similarweb` and `SIMILARWEB_API_KEY`, and monthly history is
fetched, cached in `traffic_monthly`, and used in place of the index value.
Without a key — the production case — `monthlyTraffic()` returns `null` for
every domain. It never fabricates a series, and it is skipped entirely for a
store the platform's own crawl has already measured.

### Architecture

```
app/(auth)/*      sign in, sign up, reset, verify, accept invite
app/(app)/*       the product — every page behind requireCtx()
app/(public)/*    anonymous, edge-cached pages: /store/{domain}, /stores, /trending, /weekly
app/api/public/*  anonymous JSON (store card, weekly report) used by the extension, CLI and MCP
app/api/mcp       MCP server (JSON-RPC 2.0, OAuth 2.1 bearer)
app/oauth/*       consent screen; app/api/oauth/* token + registration
lib/market/*      index client, service token, shop and creative mappers
lib/traffic/*     SimilarWeb mapping + labels, CrUX ranks, licensed-provider cache
lib/auth/*        passwordless (magic link) sign-in, sessions, request guards
lib/migrations/   SQL, applied in filename order by npm run migrate
packages/*        shopify-inspect (CLI) and adlibraryspy-mcp (stdio MCP), npm workspaces
extension/        Chrome extension (Manifest V3, activeTab only)
leaderboard/      the weekly README table and its GitHub Action
scripts/          migrations runner, snapshot + weekly-report jobs
```

Multi-tenancy is enforced in `lib/auth/guard.ts`: a `workspace_id` is always
resolved from the session, never accepted from a request.

### MCP

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

### Data honesty rules

These are load-bearing, not stylistic. The predecessor to this codebase
synthesised traffic history (linear interpolation plus random noise), modelled
visit counts from ad and follower counts, and presented both as measurements.
All of that is gone.

- **A number is rendered only if something measured it.** `monthlyVisits` is
  SimilarWeb's measurement of the store's own host (`sw_visits`) or, where the
  crawl has not reached the store, the index's `monthly_traffic` — labelled as
  the index's estimate wherever it appears. There is no fallback estimator.
- **Traffic history is only real, named months.** SimilarWeb's measured months
  on a dossier, the index's own recorded months on a store it has not measured;
  the two are never concatenated. A chart needs two real points (`MIN_POINTS` in
  `components/charts.tsx`) or it does not render at all.
- **Absent data renders nothing.** No grey box where an image failed, no `—`
  standing in for a metric that was never collected, no `href="#"`.
  `components/ShopMedia.tsx` returns `null` on a missing or broken image rather
  than an empty frame.
- **`null` ≠ `0`.** The MCP tool descriptions tell assistants this explicitly,
  because a model that reads a missing measurement as zero will draw a false
  conclusion from it.
- **A model judgment is labelled as one.** AI creative labels carry their
  confidence and are never presented as a measured fact; an absent label means
  the model was not sure, not that the ad lacks that trait.
- **Features without data are not sold.** A screen whose data the index does
  not hold is not shipped, rather than filled with sample rows or invented counts.

### Run it locally

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL (PGSSL=off for a local Postgres) and SMTP_*
npm run migrate
npm run dev                    # http://localhost:4311
npm test && npm run typecheck
```

SMTP is required to sign in: there are no passwords, and every sign-in is a link sent by email. A local mail
catcher such as Mailpit works (`SMTP_HOST=localhost`, `SMTP_PORT=1025`). Unless you change `MARKET_API_BASE`, a
local instance reads the public index at `api.platformdtc.com`.

Accounts, workspaces, roles, API keys, OAuth, the brandtracker and the public pages all run on your own
Postgres. **Store and ad data come from the AdLibrarySpy market index**, a hosted service this repo is a
client of. The index's shop endpoints are public, while ad creatives need a service account
(`PLATFORM_JWT_SECRET`, `MARKET_SERVICE_ACCOUNT_ID`). If you want to run your own instance against the
index, [open an issue](https://github.com/PSA-Team-source/AdLibrarySpy/issues). Without those variables, the
app shows no creatives instead of inventing any.

## How it works

```
 your terminal / AI assistant / browser
        │
        ├─ shopify-inspect ──────────▶ the store itself: /meta.json, /collections/all, /products.json, homepage
        │
        ├─ lookup_store, weekly_report ─▶ adlibraryspy.com/api/public/*   (anonymous, edge-cached)
        │
        └─ search_shops, search_ads… ──▶ adlibraryspy.com/api/mcp          (free key or OAuth)
```

The live-storefront reader runs entirely on your machine. The index (store traffic, the ad library, AI creative labels,
brand tracking) is the hosted [AdLibrarySpy](https://adlibraryspy.com/?ref=gh:readme) service, and it's free.

## Contributing

App and pixel signatures are the easiest place to start: add a vendor host and a test, and every user
benefits. Bug fixes and features in the web app are welcome too. See [CONTRIBUTING.md](CONTRIBUTING.md).
If this saves you research time, **a ⭐ helps other people find it.**

## License

[MIT](LICENSE). The AdLibrarySpy name and logo, third-party logos and the screenshots are not covered; see [NOTICE.md](NOTICE.md).
