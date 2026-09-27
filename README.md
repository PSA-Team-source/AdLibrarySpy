<div align="center">

<img src="extension/icons/icon-128.png" width="72" height="72" alt="">

# AdLibrarySpy

**100% free Shopify store and Meta ads intelligence, built for the community.**

Find the stores that are winning, see the ads they run, and track your competitors.
Every number comes from a real measurement with its source attached. Nothing is estimated.

[**Open the app →**](https://adlibraryspy.com/?ref=gh:readme) · [Run it yourself](#run-it-yourself) · [Use it from Claude or ChatGPT](#ask-your-ai) · [This week's breakouts](#this-weeks-shopify-breakouts)

[![CI](https://github.com/PSA-Team-source/AdLibrarySpy/actions/workflows/ci.yml/badge.svg)](https://github.com/PSA-Team-source/AdLibrarySpy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![Free](https://img.shields.io/badge/price-free-brightgreen)

<img src="public/landing/shops.webp" alt="The AdLibrarySpy Shops explorer: stores ranked by ads, with monthly traffic, growth, AOV, live ads and top products" width="900">

</div>

## What it is

AdLibrarySpy indexes **14.7M online stores, 3.9M of them on Shopify** (as of September 2026), and the
Meta ads they run. It shows you which stores are growing, what they sell and how they advertise.
Traffic figures come from SimilarWeb's measurement of each store's exact domain, labelled with the month
they cover. Ad data comes from the Meta Ad Library.

It's free: there are no plans, no credit limits and no checkout. It's also open source under MIT, and
this repository is the code that runs [adlibraryspy.com](https://adlibraryspy.com/?ref=gh:readme).

## Features

### Shops: find the stores that are winning

- Filter by platform (Shopify, WooCommerce, Shopline, Shoplazza and others), category, traffic,
  traffic growth, product count, store origin, visitor country, creation date, technology and pixels
- SimilarWeb visits and month-over-month growth for the exact store, with a trend line
- AOV, live Meta ads, 7-day ad peak, top products and launch year on every row
- Hide stores you've already seen, and save stores to shared folders
- **Export CSV**: the current filters and sort, up to 1,000 rows, ready for Excel or Sheets

### Ads: the creative library

<img src="public/landing/ads.webp" alt="Ads library" width="820">

- Search ad copy, brands and landing pages, then filter by creation date, media type, format, placement,
  country and niche
- Run dates and placements for each ad, with video playback in the grid
- **AI creative labels**: hook, angle, funnel stage, offer and urgency, each with the model's confidence
- Save ads to folders and share them with your team. The **Advertisers** screen ranks brands by creative count
- **Export CSV** of the current search: ad and page ids, run dates, status, format, placements, copy, landing and media URLs

### Store dossier: everything about one store

<img src="public/landing/dossier.webp" alt="Store dossier for Gymshark" width="820">

- Monthly visits and traffic over time, plus visitor countries
- Live Meta ads over time, with a link to the store's ads
- Product count, best sellers and latest products, the theme, currency and locale
- The pixels and apps the store runs, and similar shops

### Brandtracker: watch your competitors

<img src="public/landing/brandtracker.webp" alt="Brandtracker" width="820">

- Track any store. A snapshot of its traffic, live ads and new ads is recorded every day
- See what changed across 1, 7, 14 and 30 days, and organise tracked stores in folders
- **Daily alerts by email** (or weekly, or off): new ads, live-ad and traffic moves for the brands you track, new
  results for the Shops and Ads searches you save, and the stores that added the most live Meta ads the day
  before, in your niche. Sent only when something changed

### Trends and the Monday report

<img src="public/landing/weekly.webp" alt="Weekly report" width="820">

- **Trends**: niches, stores and products whose measured traffic is breaking out
- **The weekly report**: stores scaling their ads, the fastest traffic growth, ad peaks and the newest
  winners, published every Monday at [/weekly](https://adlibraryspy.com/weekly) and sent by email if you opt in
- Public, shareable pages for every store (`/store/{domain}`), a store directory by niche, country and
  tech, and [/trending](https://adlibraryspy.com/trending)

### Ask your AI

A built-in **MCP server** (OAuth 2.1) lets Claude, ChatGPT and other assistants search shops and ads,
open dossiers and manage your brandtracker with your workspace's access. In Claude, go to Settings →
Connectors → *Add custom connector* and paste `https://adlibraryspy.com/api/mcp`.
Any other agent: paste *"Read https://adlibraryspy.com/SKILL.md and follow it to research my competitors' Shopify stores and Meta ads."*
[All clients and tools →](docs/mcp.md)

### Teams, API and extension

- Free team workspaces with roles, invites, shared saves and an activity log. Sign-in is passwordless (an emailed 6-digit code or magic link, or Sign in with Google)
- API keys for the MCP endpoint (Settings → API)
- In-app feedback (sidebar → Feedback): stored in the `feedback` table and emailed to `FEEDBACK_EMAIL`, with Reply-To set to the sender (10 messages an hour per user; `FAIR_USE.feedback`). Rate limits for agents: [/SKILL.md](https://adlibraryspy.com/SKILL.md#rate-limits)
- A [Chrome extension](extension/) that shows any Shopify store's traffic, ads, products and apps in one click

## Why trust the numbers

- **A figure appears only if something measured it**, and it carries its source and period, for example
  *SimilarWeb · Aug 2026*. Traffic history shows only real months, and a chart needs two real data points
  to be drawn at all.
- **A missing value is shown as nothing**, never as `0`, a dash or a guess.
- **AI labels are marked as model judgments**, with a confidence. When a label is missing, the model wasn't sure.

The full rules are in [docs/data-honesty.md](docs/data-honesty.md).

## This week's Shopify breakouts

Updated every week by a GitHub Action from the public weekly report.

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

## Run it yourself

```bash
git clone https://github.com/PSA-Team-source/AdLibrarySpy && cd AdLibrarySpy
npm install                    # Node 22.18+
cp .env.example .env.local     # set DATABASE_URL (PGSSL=off for a local Postgres) and SMTP_*
npm run migrate
npm run dev                    # http://localhost:4311
npm test && npm run typecheck
```

SMTP is required because every sign-in is a link sent by email. A local mail catcher such as Mailpit works
(`SMTP_HOST=localhost`, `SMTP_PORT=1025`).

**Where the data comes from:** accounts, workspaces, the brandtracker, saves, API keys, OAuth and the public
pages all run on your own Postgres. Store and ad data come from the **AdLibrarySpy market index**, a hosted
service this app is a client of. Its shop endpoints are public, so a local instance shows stores out of the
box. Ad creatives need a service account (`PLATFORM_JWT_SECRET`, `MARKET_SERVICE_ACCOUNT_ID`). Without one,
the ads screens stay empty rather than inventing anything. To run your own instance against the full index,
[open an issue](https://github.com/PSA-Team-source/AdLibrarySpy/issues).

### Configuration

All variables are listed, with placeholders, in [`.env.example`](.env.example).

| Variable | Required | Effect when unset |
|---|---|---|
| `DATABASE_URL` | yes | App cannot start; `/api/health` returns 503 |
| `PGSSL` | no | TLS on; set `off` for a local Postgres without TLS |
| `PG_POOL_MAX` | no | Defaults to 10 connections |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | yes | Sign-in is an emailed code + magic link: nobody can sign in, and invites cannot send |
| `FEEDBACK_EMAIL` | no | Where in-app feedback is emailed (defaults to the maintainers). Every message is also kept in the `feedback` table |
| `GOOGLE_CLIENT_ID` | no | OAuth "Web application" client id (Authorized JavaScript origins = your `APP_BASE_URL`). Set = Sign in with Google + One Tap on `/login` and `/signup`; unset = email link only |
| `APP_BASE_URL` | yes in production | Links in mail and OAuth metadata point at `http://localhost:4311` |
| `SESSION_SECRET` | yes | At least 16 characters; keys the emailed sign-in codes (stored as an HMAC) and signs unsubscribe links. Without it email sign-in cannot issue a code |
| `MARKET_API_BASE` | no | Defaults to the public index, `https://api.platformdtc.com/api/v1` |
| `MARKET_TIMEOUT_MS` | no | Defaults to 12000 |
| `PLATFORM_JWT_SECRET`, `MARKET_SERVICE_ACCOUNT_ID`, `MARKET_SERVICE_EMAIL` | for ad creatives and MCP | Service account issued by the index operator; without it ad creatives return empty (shops still work) |
| `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | no | Funnel events are not recorded |
| `TRAFFIC_PROVIDER` + `SIMILARWEB_API_KEY` / `SEMRUSH_API_KEY`, `TRAFFIC_CACHE_DAYS` | no | Traffic comes only from the index's SimilarWeb crawl (see [architecture](docs/architecture.md#traffic)) |
| `NEXT_PUBLIC_CHROME_EXTENSION_URL` | no | The homepage shows no extension link |
| `APP_VERSION` | no | `/api/health` reports `dev` |
| `WEEKLY_MAIL_PER_SEC` | no | Weekly report sends 4 emails per second |
| `ALERTS_SEND_GAP_MS` | no | Alerts digest waits 3000 ms between emails (steady warm-up traffic) |

### Tech stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind · Radix UI and shadcn/ui ·
TanStack Query · PostgreSQL · ClickHouse (optional funnel analytics) · Cloudflare edge cache.
Multi-tenancy is enforced in `lib/auth/guard.ts`: a `workspace_id` always comes from the session, never
from the request. See [docs/architecture.md](docs/architecture.md) for the layout, the traffic model,
the AI labels and the MCP server.

## Also in this repo

| | |
|---|---|
| [`extension/`](extension) | The Chrome extension (Manifest V3, `activeTab` only, nothing runs in the background). |
| [`packages/shopify-inspect`](packages/shopify-inspect) | `npx shopify-inspect <store>`: reads any Shopify store's theme, best sellers, newest products, prices, apps and pixels from its own storefront, from your terminal. Zero dependencies. |
| [`packages/mcp`](packages/mcp) | `adlibraryspy-mcp`: a local (stdio) MCP server for Claude Code, Cursor and VS Code, with three tools that need no account. |
| [`leaderboard/`](leaderboard) | The Action behind the weekly table above. |

<img src=".github/assets/shopify-inspect.gif" alt="npx shopify-inspect deathwishcoffee.com in a terminal" width="640">

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Questions and ideas go to [Discussions](https://github.com/PSA-Team-source/AdLibrarySpy/discussions). Adding app and pixel
signatures to `shopify-inspect` is an easy first contribution. If AdLibrarySpy helps you, **a ⭐ helps other
people find it.**

## Star history

<a href="https://star-history.com/#PSA-Team-source/AdLibrarySpy&Date">
  <img src="https://api.star-history.com/svg?repos=PSA-Team-source/AdLibrarySpy&type=Date" alt="Star history of AdLibrarySpy" width="600">
</a>

## License

[MIT](LICENSE). The AdLibrarySpy name and logo, third-party logos and the screenshots are not covered.
See [NOTICE.md](NOTICE.md).
