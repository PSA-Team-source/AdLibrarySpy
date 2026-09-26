// Markdown for the weekly leaderboard. Pure, so test.mjs can check it offline.
const SITE = 'https://adlibraryspy.com';
const REF = 'ref=gh:leaderboard';

const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const flag = cc => (/^[A-Z]{2}$/.test(cc ?? '') ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) : '');
const storeLink = i => `[${cell(i.name || i.domain)}](${SITE}/store/${encodeURIComponent(i.domain)}?${REF})`;

export function sectionTable(section, limit = 10) {
  const rows = section.items.slice(0, limit).map((i, n) =>
    `| ${n + 1} | ${storeLink(i)} | ${cell(i.niche)} | ${flag(i.country)} | **${cell(i.metric)}** | ${cell(i.detail)} |`);
  return [
    `### ${cell(section.title)}`,
    '',
    `<sub>${cell(section.blurb)} Source: ${cell(section.source)}</sub>`,
    '',
    '| # | Store | Niche | | Change | Measured |',
    '|--:|---|---|:-:|--:|---|',
    ...rows,
  ].join('\n');
}

/** The full week, one file per ISO week. */
export function weekMarkdown(report) {
  const d = report.data;
  return [
    `# Shopify breakouts: ${cell(d.weekLabel)} (${d.weekStart} → ${d.weekEnd})`,
    '',
    `Every figure is copied from a measurement with its source and period beside it. Nothing here is modelled or estimated. `
      + `Interactive version: [${report.url.replace('https://', '')}](${report.url}?${REF}).`,
    '',
    ...d.sections.filter(s => s.items.length).flatMap(s => [sectionTable(s, 25), '']),
  ].join('\n');
}

/** The block between the README markers: the two headline sections. */
export function readmeBlock(report) {
  const d = report.data;
  const pick = ['scaling', 'growth'].map(k => d.sections.find(s => s.key === k)).filter(s => s?.items.length);
  return [
    `<!-- leaderboard:start -->`,
    `**${cell(d.weekLabel)}** · updated ${report.publishedAt.slice(0, 10)} · [full week](leaderboard/weekly/${report.week}.md) · [all weeks](leaderboard/weekly/)`,
    '',
    ...pick.flatMap(s => [sectionTable(s, 10), '']),
    `<!-- leaderboard:end -->`,
  ].join('\n');
}

export function replaceBlock(readme, block) {
  const re = /<!-- leaderboard:start -->[\s\S]*?<!-- leaderboard:end -->/;
  if (!re.test(readme)) throw new Error('README has no leaderboard markers');
  return readme.replace(re, block);
}
