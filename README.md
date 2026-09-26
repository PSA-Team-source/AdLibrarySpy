<div align="center">

# AdLibrarySpy

**Open-source Shopify competitor research: a CLI, an MCP server for AI assistants, a Chrome extension and a weekly leaderboard.**

See any store's best sellers, apps, traffic and live Meta ads, or ask Claude which stores are scaling this week.
Every number carries its source. Nothing is estimated.

[![CI](https://github.com/PSA-Team-source/adlibraryspy/actions/workflows/ci.yml/badge.svg)](https://github.com/PSA-Team-source/adlibraryspy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node 18+](https://img.shields.io/badge/node-%E2%89%A518-43853d)

[Quick start](#quick-start) · [MCP for Claude & Cursor](#ask-your-ai-assistant) · [This week's leaderboard](#this-weeks-shopify-breakouts) · [Data honesty](docs/data-honesty.md) · [adlibraryspy.com](https://adlibraryspy.com/?ref=gh:readme)

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

App and pixel signatures are the easiest place to start. Add a vendor host and a test, and every user
benefits. See [CONTRIBUTING.md](CONTRIBUTING.md). If this saves you research time, **a ⭐ helps other people find it.**

## License

[MIT](LICENSE)
