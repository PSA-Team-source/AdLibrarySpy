// Node module-resolution hook that lets a cron script import the app's own
// TypeScript (Node strips the types) the way Next resolves it: `@/x` is the
// repo root (tsconfig "paths"), and an extensionless relative import from a .ts
// file finds x.ts / x.tsx / x/index.ts. Registered by scripts/alerts-digest.mjs
// so the job runs the SAME loaders as the pages instead of a copy of them.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function file(base) {
  for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts']) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../'))
    && /\.tsx?$/.test(context.parentURL ?? '') && context.parentURL.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const hit = base && file(base);
  return next(hit ? pathToFileURL(hit).href : specifier, context);
}
