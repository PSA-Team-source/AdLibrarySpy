# Architecture

How the AdLibrarySpy web app is put together. For setup, see the [README](../README.md#run-it-yourself).

## Layout

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
