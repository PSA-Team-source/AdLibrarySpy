import { SITE_URL, REPO_URL } from '@/lib/public/site';
import { FAIR_USE } from '@/lib/ratelimit';

// /SKILL.md: instructions an AI agent follows when a user pastes AGENT_MESSAGE
// (lib/public/site.ts; shown in the app announcement). Agent Skills format
// (YAML front matter + Markdown), so it can also be saved as a skill as-is.
// Everything it names is live: the hosted MCP (workspace key or OAuth) and the
// two public JSON endpoints. The local npm server is not published yet, so it
// is not offered here. Tool names and arguments mirror lib/mcp/tools.ts.
export const dynamic = 'force-static';

// Limits come from FAIR_USE, the one source the API enforces, so the doc cannot drift.
const [mcpMin, mcpWs, mcpUser, mcpIp] = FAIR_USE.mcp('', '', '').map(q => q.limit.toLocaleString('en-US'));
const [pubMin, pubDay] = FAIR_USE.public('', '').map(q => q.limit.toLocaleString('en-US'));

const body = `---
name: adlibraryspy
description: Research Shopify stores and their Meta (Facebook and Instagram) ads with AdLibrarySpy. Use when the user asks about a competitor's store, its traffic, best sellers, apps, live ads, ad creatives, winning products, or which stores are scaling this week.
---

# AdLibrarySpy for AI agents

AdLibrarySpy (${SITE_URL}) indexes Shopify stores with their measured traffic, catalogue,
apps and pixels, and the ad creatives they run from the Meta Ad Library. It is free and
open source (MIT, ${REPO_URL}).

Follow these steps in order. Stop at the first one that answers the user's question.

## 1. No setup: public JSON (works for any agent that can fetch a URL)

- **One store:** \`GET ${SITE_URL}/api/public/store?domain={domain}\`
  Returns name, country, niche, monthly traffic with its source and month, traffic history,
  live Meta ad count, best-selling products, apps and pixels. \`404 not_found\` = not indexed yet.
- **This week's winners:** \`GET ${SITE_URL}/api/public/weekly\` (or \`?week=2026-w39\`)
  Scaling stores, fastest traffic growth, ad peaks, newest winners, niche movers, products.
- **Human-readable pages** to link the user to: \`${SITE_URL}/store/{domain}\`, \`${SITE_URL}/stores/trending\`, \`${SITE_URL}/weekly\`.

## 2. Full index: the hosted MCP server

For searching across stores, products and ads, use the MCP server at \`${SITE_URL}/api/mcp\`.

**If your client supports remote MCP connectors** (Claude, Claude Code, Cursor, VS Code):
ask the user to add it once, then use the tools directly.

- Claude (web/desktop/mobile): Settings → Connectors → Add custom connector → \`${SITE_URL}/api/mcp\` → sign in.
- Claude Code: \`claude mcp add --transport http adlibraryspy ${SITE_URL}/api/mcp\`

**Otherwise, sign the user in by email code (no website visit, no password, free):**

1. Ask the user: "What email should I use for AdLibrarySpy? I'll send you a 6-digit code."
2. \`POST ${SITE_URL}/api/agent/sign-in\` with JSON \`{"email":"<their email>"}\`.
3. Ask the user: "Please tell me the 6-digit code we just emailed you."
4. \`POST ${SITE_URL}/api/agent/verify\` with JSON \`{"email":"<same email>","code":"<6 digits>"}\`.
   The reply has \`api_key\`. Use it as \`$ADLIBRARYSPY_API_KEY\` below for the rest of the conversation.
   A new address gets its free account automatically. Never print the key back to the user, and never invent one.
   If the reply says \`code_wrong\`, ask again; \`code_expired\`, go back to step 2.

\`\`\`bash
curl -s ${SITE_URL}/api/agent/sign-in -H "Content-Type: application/json" -d '{"email":"you@example.com"}'
curl -s ${SITE_URL}/api/agent/verify  -H "Content-Type: application/json" -d '{"email":"you@example.com","code":"123456"}'
\`\`\`

Then call the tools:

\`\`\`bash
curl -s ${SITE_URL}/api/mcp \\
  -H "Authorization: Bearer $ADLIBRARYSPY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_shops","arguments":{"query":"coffee","sortBy":"growth","limit":10}}}'
\`\`\`

Send \`{"jsonrpc":"2.0","id":1,"method":"tools/list"}\` first to get every tool's full input schema.

| Tool | Use it for |
|---|---|
| \`search_shops\` | Stores by \`query\`, \`category\`, \`country\`, \`minProducts\`/\`maxProducts\`; \`sortBy\` traffic, growth, ads, products, newest |
| \`get_shop\` | Full dossier for \`shop\` (domain or \`shp_…\` id): traffic history, ranks, engagement, traffic sources, top countries and keywords, catalogue, recent creatives |
| \`find_similar_shops\` | Lookalikes of a \`shop\` (same category, similar traffic) |
| \`search_products\` | Winning products: storefront products Meta ads land on, with price, active and new ads, advertiser pages, first-ad date |
| \`search_landing_pages\` | Landing pages ads send people to (advertorial, listicle, quiz, collection, homepage), with active and new ads, advertisers, first/last seen, countries |
| \`search_ads\` | Creatives by \`query\`, \`mediaType\`, \`country\`, or AI label (\`hook\`, \`angle\`, \`funnelStage\`, \`offer\`, \`urgency\`) |
| \`get_ad\` | One creative with its AI labels and confidence |
| \`creative_breakdown\` | How one store's ads split by hook, angle, offer and funnel stage |
| \`list_categories\`, \`trending_categories\` | Valid category names; categories ranked by ad volume |
| \`list_tracked_brands\`, \`brand_changes\`, \`track_brand\`, \`untrack_brand\` | The user's brandtracker: watch a store and see what changed. Only track or untrack when the user asks. |

## Recipes

- **"Spy on competitor.com":** public store card → \`get_shop\` → \`creative_breakdown\` → \`find_similar_shops\`.
- **"What is selling in {niche}?":** \`list_categories\` → \`search_products\` with that \`category\`, \`sortBy: "new_ads"\`.
- **"Find ad angles for {product}":** \`search_ads\` with \`query\` → group results by \`labels.hook\` and \`labels.angle\`.
- **"Who is scaling this week?":** \`/api/public/weekly\`, then \`get_shop\` on the stores the user cares about.

## Rules (read before answering)

- **\`null\` means not measured, never zero.** Say "no data" instead of "0 visits" or "no ads".
- **Name the source and month** of every traffic figure, e.g. "15.8M visits (SimilarWeb, Aug 2026)".
- **Ads are Meta only** (Facebook and Instagram). TikTok and Google ads are not covered; do not claim they are absent.
- **AI labels are model classifications** with a confidence. A missing label means the model was unsure.
- **Link your sources** to the user with \`${SITE_URL}/store/{domain}\` so they can check the figures.

## Rate limits

Everything is free, so usage is capped by fair-use limits (no paid tier to upgrade to).

| Surface | Burst | Daily (rolling 24 h from the first call) |
|---|---|---|
| Hosted MCP \`tools/call\` | ${mcpMin} a minute per workspace | ${mcpWs} per workspace, ${mcpUser} per user, ${mcpIp} per IP |
| Public JSON (\`/api/public/*\`) | ${pubMin} a minute per IP | ${pubDay} per IP |

- \`initialize\`, \`tools/list\` and \`ping\` spend one burst hit and nothing from the daily caps. A JSON-RPC batch spends one hit per \`tools/call\` in it.
- Every MCP response carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (seconds until the tightest window resets). Pace yourself on \`X-RateLimit-Remaining\`.
- A refusal is **HTTP 429** with \`Retry-After\`. Wait that many seconds, then retry once. If the message says the daily limit is reached, stop and tell the user it resets within 24 hours; do not loop.
- Public JSON is edge-cached, so repeat reads of the same store are cheap. Prefer \`search_*\` with \`limit\` up to 50 over many single lookups.

## Errors

| Response | Meaning | What to do |
|---|---|---|
| \`401 invalid_token\` | Missing, wrong or revoked key | Sign in again by email code (step 2 above) |
| \`404 not_found\` (public store) | Store not indexed yet | Say so; do not guess its numbers |
| \`429\` | Rate limit | See above |
| \`502\`/\`503\` with \`Retry-After\` | Data source briefly unavailable | Retry once after the delay |

Docs: ${REPO_URL}/blob/main/docs/mcp.md · Feedback or bugs: ${REPO_URL}/issues
`;

export function GET() {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
