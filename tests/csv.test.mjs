// CSV writer behind every download (lib/csv.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv, csvFileName, collectPages } from '../lib/csv.ts';

test('fields are quoted only when RFC 4180 requires it', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

test('text a spreadsheet would evaluate is neutralised; numbers stay numbers', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
  for (const s of ['+1 buy now', '-50% off', '@SUM(A1)', '\tx']) assert.equal(csvCell(s)[0] === '"' ? csvCell(s)[1] : csvCell(s)[0], "'", s);
  assert.equal(csvCell(-12.5), '-12.5');
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell(Number.NaN), '');
  assert.equal(csvCell(true), 'true');
});

const BOM = String.fromCharCode(0xfeff);

test('documents carry a BOM, a header and CRLF rows', () => {
  const csv = toCsv(['a', 'b'], [[1, 'x,y'], ['é', null]]);
  assert.equal(csv, BOM + 'a,b\r\n1,"x,y"\r\né,\r\n');
  assert.equal(csvFileName('shops', new Date('2026-09-27T23:59:00Z')), 'adlibraryspy-shops-2026-09-27.csv');
});

test('collectPages walks pages in order, stops at the cap or the end, drops repeats', async () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({ id: `r${i}` }));
  const calls = [];
  const load = (total) => async (page) => {
    calls.push(page);
    const items = rows.slice((page - 1) * 100, page * 100);
    return { items, total, hasMore: page * 100 < rows.length };
  };
  const all = await collectPages(load(250), { pageSize: 100, maxRows: 1000, concurrency: 4 });
  assert.equal(all.length, 250);
  assert.equal(all[249].id, 'r249');
  assert.deepEqual(calls.sort(), [1, 2, 3]);

  calls.length = 0;
  const capped = await collectPages(load(null), { pageSize: 100, maxRows: 150 });
  assert.equal(capped.length, 150);
  assert.deepEqual(calls, [1, 2]);

  const dup = await collectPages(async p => ({ items: p === 1 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'b' }, { id: 'c' }], total: 4, hasMore: p === 1 }),
    { pageSize: 2, maxRows: 10, concurrency: 2 });
  assert.deepEqual(dup.map(r => r.id), ['a', 'b', 'c']);
});
