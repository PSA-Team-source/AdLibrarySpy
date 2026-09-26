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
| `find_similar_shops` | Stores in the same category at a similar traffic level |
| `search_ads` | Ad creatives by keyword, network, media, country, or AI label (hook, angle, funnel stage, offer, urgency) |
| `get_ad` | One creative, with its AI labels and confidence |
| `creative_breakdown` | How a store's ads split by hook, angle, offer, funnel stage |
| `list_categories`, `trending_categories` | The category tree, and categories ranked by ad volume |
| `list_tracked_brands`, `brand_changes`, `track_brand`, `untrack_brand` | Your workspace brandtracker: record a store on a schedule and see what moved (these need the matching scopes) |

A free key comes from **https://adlibraryspy.com/settings/api**. It's free, and so is the whole product.

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

- **Rate limits:** the hosted index allows 600 calls a minute per workspace, and the public endpoints allow 60 a minute per IP (most of those are served from the edge cache).
- **Missing values:** `null` means nothing measured that value. Assistants are told this in the tool descriptions, because reading a missing value as zero leads to false conclusions.
