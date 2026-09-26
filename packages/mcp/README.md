# adlibraryspy-mcp

An MCP server that answers questions about Shopify stores and their ads for Claude, Cursor, VS Code or any
MCP client: which stores are scaling, what they sell, which apps they run and which ads they're running.

```bash
claude mcp add adlibraryspy -- npx -y adlibraryspy-mcp
```

It works without an account (`inspect_store`, `lookup_store`, `weekly_report`). Add a free
`ADLIBRARYSPY_API_KEY` from https://adlibraryspy.com/settings/api to also search over a million stores and
their ad creatives.

Setup for every client, the full tool list and example prompts: **[docs/mcp.md](../../docs/mcp.md)**.

MIT
