import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readmeBlock, replaceBlock, sectionTable } from './render.mjs';

const item = { domain: 'a.com', name: 'A | B', niche: 'Apparel', country: 'US', metric: '+10%', detail: '1K → 1.1K visits' };
const report = {
  week: '2026-w39', publishedAt: '2026-09-25T00:00:00Z', url: 'https://adlibraryspy.com/weekly/2026-w39',
  data: { weekLabel: 'Week 39, 2026', weekStart: '2026-09-21', weekEnd: '2026-09-27', sections: [
    { key: 'growth', title: 'Growth', blurb: 'b.', source: 's', items: [item] },
    { key: 'scaling', title: 'Scaling', blurb: 'b.', source: 's', items: [] },
  ] },
};

test('tables escape pipes, flag countries and link the public store page', () => {
  const t = sectionTable(report.data.sections[0]);
  assert.match(t, /\[A \\\| B\]\(https:\/\/adlibraryspy\.com\/store\/a\.com\?ref=gh:leaderboard\)/);
  assert.match(t, /🇺🇸/);
});

test('README block skips empty sections and replaces only between markers', () => {
  const b = readmeBlock(report);
  assert.ok(b.includes('### Growth') && !b.includes('### Scaling'));
  assert.equal(replaceBlock('x\n<!-- leaderboard:start -->old<!-- leaderboard:end -->\ny', 'NEW'), 'x\nNEW\ny');
  assert.throws(() => replaceBlock('no markers', 'NEW'));
});
