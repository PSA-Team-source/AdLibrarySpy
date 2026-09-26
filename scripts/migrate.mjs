// Apply pending SQL migrations. Safe to re-run.
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
const { rows } = await client.query('SELECT filename FROM schema_migrations');
const applied = new Set(rows.map(r => r.filename));
const dir = path.join(process.cwd(), 'lib', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
let ran = 0;
for (const f of files) {
  if (applied.has(f)) { console.log(`  skip ${f}`); continue; }
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log(`  APPLIED ${f}`);
    ran++;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`  FAILED ${f}: ${e.message}`);
    process.exit(1);
  }
}
console.log(ran ? `${ran} migration(s) applied` : 'up to date');
await client.end();
