// Postgres access. One pool per process; every business query is workspace-scoped
// by its caller (see lib/auth/guard.ts, which resolves the workspace first).
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const g = globalThis as unknown as { __ML_POOL?: Pool };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

export function pool(): Pool {
  if (!g.__ML_POOL) {
    g.__ML_POOL = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // RDS terminates TLS with an Amazon CA that isn't in the default bundle.
      ssl: process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false },
    });
    g.__ML_POOL.on('error', (err) => console.error('[db] idle client error', err.message));
  }
  return g.__ML_POOL;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool().query<T>(text, params as never[]);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction, rolling back on any throw. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    // fangcode:allow — ROLLBACK failure is unrecoverable; the original error
    // is what the caller needs to see, and there is nothing meaningful to do
    // if the rollback itself also fails.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** True when the DB is reachable — used by /api/health. */
export async function dbHealthy(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ---------- migrations ----------
const MIGRATIONS_DIR = path.join(process.cwd(), 'lib', 'migrations');

export async function migrate(): Promise<string[]> {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set((await query<{ filename: string }>('SELECT filename FROM schema_migrations')).map(r => r.filename));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const ran: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    await tx(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
    });
    ran.push(f);
  }
  return ran;
}
