#!/usr/bin/env node
/**
 * Import Chrome UX Report popularity ranks from crissyfield/crux-dumps.
 *
 * Each dump file holds the origins in one rank band. Origins are normalised to
 * a registrable-ish domain (https://www.example.com/ -> example.com) and the
 * BEST (numerically lowest) band wins when several origins map to one domain —
 * http/https/www variants of the same site otherwise fight each other.
 *
 * Streams straight into Postgres COPY so 18M rows never sit in memory.
 *
 *   node scripts/import-crux.mjs            # latest month
 *   node scripts/import-crux.mjs 202606     # a specific month
 */
import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import readline from 'node:readline';

const META = 'https://github.com/crissyfield/crux-dumps/raw/main/meta.json';
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const wanted = process.argv[2];

const cleanDomain = (origin) => {
  let d = String(origin || '').trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0].split('#')[0];
  d = d.replace(/:\d+$/, '');                     // strip an explicit port
  return d.includes('.') && !d.includes(' ') ? d : '';
};

console.log('fetching dump metadata…');
const meta = await (await fetch(META)).json();
const months = meta.years.flatMap(y => y.months).sort((a, b) => String(a.id).localeCompare(String(b.id)));
const month = wanted ? months.find(m => String(m.id) === wanted) : months[months.length - 1];
if (!month) { console.error(`month ${wanted} not found`); process.exit(1); }

const files = [...month.files].sort((a, b) => a.rank - b.rank);
console.log(`month ${month.id}: ${files.length} rank bands`);

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('SET statement_timeout = 0');
await client.query(
  `INSERT INTO crux_import (month) VALUES ($1)
   ON CONFLICT (month) DO UPDATE SET started_at = now(), finished_at = NULL`, [month.id]);

// Stage into an UNLOGGED table: one COPY per band, dedupe once at the end.
await client.query('DROP TABLE IF EXISTS crux_stage');
await client.query('CREATE UNLOGGED TABLE crux_stage (domain text, rank_bucket int)');

let origins = 0;
for (const f of files) {
  process.stdout.write(`  band <=${String(f.rank).padEnd(9)} `);
  // curl | xz -dc keeps the 93 MiB of archives off disk entirely.
  const curl = spawn('curl', ['-sSL', f.url], { stdio: ['ignore', 'pipe', 'inherit'] });
  const xz = spawn('xz', ['-dc'], { stdio: [curl.stdout, 'pipe', 'inherit'] });
  const copy = client.query(copyFrom('COPY crux_stage (domain, rank_bucket) FROM STDIN'));

  let n = 0;
  const rl = readline.createInterface({ input: xz.stdout, crlfDelay: Infinity });
  for await (const line of rl) {
    const d = cleanDomain(line);
    if (!d) continue;
    if (!copy.write(`${d}\t${f.rank}\n`)) await new Promise(r => copy.once('drain', r));
    n++;
  }
  copy.end();
  await new Promise((res, rej) => { copy.on('finish', res); copy.on('error', rej); });
  origins += n;
  console.log(`${n.toLocaleString()} origins`);
}

console.log('deduping to one row per domain (best band wins)…');
await client.query('BEGIN');
await client.query('TRUNCATE crux_rank');
const res = await client.query(
  `INSERT INTO crux_rank (domain, rank_bucket, month)
   SELECT domain, MIN(rank_bucket), $1 FROM crux_stage
    WHERE domain <> '' GROUP BY domain`, [month.id]);
await client.query('COMMIT');
await client.query('DROP TABLE IF EXISTS crux_stage');
await client.query('ANALYZE crux_rank');
await client.query(
  'UPDATE crux_import SET origins = $2, domains = $3, finished_at = now() WHERE month = $1',
  [month.id, origins, res.rowCount]);

console.log(`done: ${origins.toLocaleString()} origins -> ${res.rowCount.toLocaleString()} domains (CrUX ${month.id})`);
await client.end();
