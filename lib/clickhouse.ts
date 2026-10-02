// ClickHouse over HTTP with server-side parameters ({name:Type} in the SQL).
// Returns JSONEachRow rows; throws when ClickHouse cannot be asked — callers
// must not guess a number they could not read.
export async function chQuery(sql: string, params: Record<string, string | number> = {}): Promise<Record<string, unknown>[]> {
  const base = process.env.CLICKHOUSE_URL;
  if (!base) throw new Error('CLICKHOUSE_URL is not set');
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`param_${k}`, String(v));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'default',
      'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
    },
    body: sql,
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`clickhouse ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.text()).split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>);
}
