#!/usr/bin/env node
// Weekly job (.github/workflows/leaderboard.yml): pull the published report
// from the public API and rewrite the README block + leaderboard/weekly/<week>.md.
import fs from 'node:fs/promises';
import { readmeBlock, replaceBlock, weekMarkdown } from './render.mjs';

const root = new URL('../', import.meta.url);
const res = await fetch('https://adlibraryspy.com/api/public/weekly', {
  headers: { Accept: 'application/json', 'User-Agent': 'adlibraryspy-leaderboard (+github actions)' },
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) throw new Error(`weekly report: HTTP ${res.status}`);
const report = await res.json();
if (!report?.data?.sections?.length) throw new Error('weekly report has no sections');

await fs.mkdir(new URL('leaderboard/weekly/', root), { recursive: true });
await fs.writeFile(new URL(`leaderboard/weekly/${report.week}.md`, root), `${weekMarkdown(report)}\n`);
await fs.writeFile(new URL('leaderboard/latest.json', root), `${JSON.stringify(report, null, 2)}\n`);
const readmeUrl = new URL('README.md', root);
await fs.writeFile(readmeUrl, replaceBlock(await fs.readFile(readmeUrl, 'utf8'), readmeBlock(report)));
console.log(`leaderboard: ${report.week}, ${report.data.sections.length} sections`);
