# Connect AdLibrarySpy to your AI assistant

There are two ways to connect, and both give you the same tools.

| | Local (npm, stdio) | Hosted (remote URL) |
|---|---|---|
| Setup | one line of config | paste a URL, sign in |
| Account needed | no (3 tools), free key for the full index | free account (OAuth) |
| Works in | Claude Desktop, Claude Code, Cursor, VS Code, anything stdio | Claude (web, desktop, mobile), any client with remote MCP + OAuth |

## Tools

**No account needed**

| Tool | What it returns |
|---|---|
| `inspect_store` | A store's live storefront: theme, currency, locale, product count, price range, best sellers and newest products in the store's own order, apps and pixels on the homepage |
| `lookup_store` | Index card: monthly visits with source + month (SimilarWeb-measured where available), growth, history, live Meta ad count, niche |
| `weekly_report` | This week's scaling stores, fastest traffic growth, ad peaks, newest winners, niche movers, products |

**With a free key or OAuth** (the hosted index)

| Tool | What it returns |
|---|---|
| `search_shops` | Stores by keyword, category, country, catalogue size, live ads; sort by traffic, growth, ads, newest |
| `get_shop` | Full dossier: traffic history, ranks, engagement, traffic-source mix, top countries and keywords |
| `search_products` | Winning products: storefront products Meta ads land on, with title, price in the store's currency, active and new ads, advertiser pages, first-ad date and the store's traffic; filter by keyword, category, ad country, price, store |
| `find_similar_shops` | Stores in the same category at a similar traffic level |
| `search_ads` | Ad creatives by keyword, network, media, country, or AI label (hook, angle, funnel stage, offer, urgency) |
| `get_ad` | One creative, with its AI labels and confidence |
| `creative_breakdown` | How a store's ads split by hook, angle, offer, funnel stage |
| `list_categories`, `trending_categories` | The category tree, and categories ranked by ad volume |
| `list_tracked_brands`, `brand_changes`, `track_brand`, `untrack_brand` | Your workspace brandtracker: record a store on a schedule and see what moved (these need the matching scopes) |

A free key comes from **https://adlibraryspy.com/settings/api**. It's free, and so is the whole product.

## Any AI agent: one message

Paste this into Claude, ChatGPT, Cursor or any agent that can read a URL:

> Read https://adlibraryspy.com/SKILL.md and follow it to research my competitors' Shopify stores and Meta ads.

[`/SKILL.md`](https://adlibraryspy.com/SKILL.md) tells the agent what to call (public JSON first, then the hosted MCP with your key), gives it recipes, and the rules for reading the data (`null` = not measured, name the traffic source). It is in the Agent Skills format, so it can also be saved as a skill.

## Claude Code

```bash
claude mcp add adlibraryspy -- npx -y adlibraryspy-mcp
# with the full index:
claude mcp add adlibraryspy -e ADLIBRARYSPY_API_KEY=ml_live_... -- npx -y adlibraryspy-mcp
# or the hosted server (signs you in with OAuth):
claude mcp add --transport http adlibraryspy https://adlibraryspy.com/api/mcp
```

## Claude (web, desktop, mobile)

Settings → Connectors → **Add custom connector** → paste `https://adlibraryspy.com/api/mcp` → sign in and approve.

## Claude Desktop (local)

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "adlibraryspy": {
      "command": "npx",
      "args": ["-y", "adlibraryspy-mcp"],
      "env": { "ADLIBRARYSPY_API_KEY": "" }
    }
  }
}
```

Leave the key empty to use the three keyless tools.

## Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) takes the same `mcpServers` block as Claude Desktop.

## VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "adlibraryspy": { "type": "stdio", "command": "npx", "args": ["-y", "adlibraryspy-mcp"] }
  }
}
```

## Prompts to try

- *"Inspect deathwishcoffee.com. What are its best sellers, and which apps does it run?"*
- *"Which Shopify stores grew fastest this week? Group them by niche."*
- *"Find coffee stores with live Meta ads, then break down the hooks and offers in their creatives."*
- *"Compare gymshark.com and alphaleteathletics.com on traffic, ads and price range."*

## Limits

- **Fair use (the API is free, so it is capped):** 120 tool calls a minute and 1,000 a day per workspace, 1,500 a day per user across all their workspaces, and 3,000 a day per IP. Only `tools/call` counts toward the daily caps; `initialize`, `tools/list` and `ping` spend one burst hit. Daily windows start at the first call and last 24 hours.
- **Public endpoints** (`/api/public/*`): 60 requests a minute and 1,000 a day per IP; most requests are served from the edge cache and never reach these limits.
- **Headers:** every MCP response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds until the tightest window resets). A refusal is HTTP 429 with `Retry-After`; back off for that many seconds.
- **Missing values:** `null` means nothing measured that value. Assistants are told this in the tool descriptions, because reading a missing value as zero leads to false conclusions.
