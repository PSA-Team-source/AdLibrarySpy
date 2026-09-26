// Optional enrichment from AdLibrarySpy's public index: measured traffic
// (SimilarWeb, with its month), live Meta ad count, niche. Anonymous, no key,
// edge-cached. A store the index has not reached returns null — never a guess.
const API = 'https://adlibraryspy.com/api/public';

export async function indexCard(domain, { timeoutMs = 8000, fetch: fetchImpl = globalThis.fetch } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${API}/store?domain=${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'shopify-inspect/1.0' },
      signal: ac.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`AdLibrarySpy index answered ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
