## What this changes

<!-- One or two sentences: what the change does and why. Link the issue it closes: "Closes #123". -->

## How I checked it

<!-- The commands you ran and what you tried in the app. For UI changes, add screenshots in light and dark mode. -->

## Checklist

- [ ] `npm run typecheck` and `npm test` pass
- [ ] New logic has a test
- [ ] Every number shown has a real source; a missing value renders nothing (see `docs/data-honesty.md`)
- [ ] Workspace data is scoped through `lib/auth/guard.ts`, never from a request parameter
- [ ] No API keys, tokens or personal data in the diff, logs or screenshots
