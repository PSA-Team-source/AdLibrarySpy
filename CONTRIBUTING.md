# Contributing

Thanks for helping. Everything here runs on Node 18+ with **zero runtime dependencies**, and we'd like to keep it that way.

```bash
git clone https://github.com/PSA-Team-source/adlibraryspy && cd adlibraryspy
npm install          # links the workspaces, nothing is downloaded
npm test             # every package + extension + leaderboard
node packages/shopify-inspect/cli.js allbirds.com
```

## The one rule: no invented numbers

A value is shown only if something measured it, and it carries its source. Read
[docs/data-honesty.md](docs/data-honesty.md) before touching anything that prints a figure.
A missing value is `null` and renders as nothing. It is never `0`, `—`, or a guess.

## Good first contributions

- **App and pixel signatures** in `packages/shopify-inspect/parse.js` (`SIGNATURES`). Add the vendor's
  script host plus a test line proving it matches a real snippet and doesn't match unrelated HTML.
- **CLI output**: new `--format` options (CSV, Markdown).
- **Client setup guides** in `docs/` for MCP clients we haven't documented yet.

## Pull requests

- Keep each PR to one change and include a test for any new logic (`node:test`, no frameworks).
- Run `npm test` before you push. CI runs it on Node 18, 20 and 22, and scans for secrets.
