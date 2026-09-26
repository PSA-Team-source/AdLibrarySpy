// Proxy to the hosted AdLibrarySpy MCP endpoint (Streamable HTTP, JSON replies).
const DEFAULT_URL = 'https://adlibraryspy.com/api/mcp';

export class HostedClient {
  constructor(key, url = DEFAULT_URL) {
    this.key = key;
    this.url = url || DEFAULT_URL;
    this.seq = 0;
    this.cached = null;
  }

  async rpc(method, params) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'User-Agent': 'adlibraryspy-mcp/1.0',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.seq, method, params }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401) throw new Error('ADLIBRARYSPY_API_KEY was rejected. Create a key at https://adlibraryspy.com/settings/api');
    if (res.status === 429) throw new Error(`Rate limited by AdLibrarySpy; retry in ${res.headers.get('retry-after') ?? '60'}s`);
    if (!res.ok) throw new Error(`AdLibrarySpy answered HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  }

  async tools() {
    this.cached ??= this.rpc('tools/list', {}).then(r => r.tools ?? []).catch(err => { this.cached = null; throw err; });
    return this.cached;
  }

  call(name, args) {
    return this.rpc('tools/call', { name, arguments: args });
  }
}
