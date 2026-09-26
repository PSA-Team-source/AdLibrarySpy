# Contributing

Thanks for helping. This repo is the whole of adlibraryspy.com: the Next.js web app at the root, plus
`packages/` (CLI and MCP server, Node 18+, **zero runtime dependencies**, and we'd like to keep it that way),
`extension/` and `leaderboard/`.

```bash
git clone https://github.com/PSA-Team-source/AdLibrarySpy && cd AdLibrarySpy
npm install                 # Node 22.18+ (the app's tests import TypeScript directly)
npm test                    # app + packages + leaderboard
npm run typecheck
node packages/shopify-inspect/cli.js allbirds.com
npm run dev                 # the web app on :4311; see README → Run it locally
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
- Run `npm test` and `npm run typecheck` before you push. CI runs the app on Node 22 and 24, runs the
  packages on Node 18 and 20, and scans for secrets.
- Web app changes: multi-tenancy goes through `lib/auth/guard.ts`. A `workspace_id` never comes from the request.
