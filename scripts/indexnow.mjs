// Submit public URLs to IndexNow (Bing, Yandex, Seznam, Naver…) so new
// /store, /stores and /weekly pages are crawled without waiting for discovery.
// Reads URLs from our own sitemaps. Usage: node scripts/indexnow.mjs [baseUrl]
// Google does not take IndexNow; its sitemap goes through Search Console.
const KEY = 'bfc2b345b3d867338dd79061e7e54f93';
const base = (process.argv[2] || 'https://adlibraryspy.com').replace(/\/$/, '');
const host = new URL(base).host;

async function locs(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(900_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

const index = await locs(`${base}/sitemap.xml`);
let sent = 0;
for (const sitemap of index) {
  const urls = (await locs(sitemap)).filter(u => new URL(u).host === host);
  for (let i = 0; i < urls.length; i += 10_000) {   // IndexNow caps a request at 10,000 URLs
    const batch = urls.slice(i, i + 10_000);
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList: batch }),
    });
    console.log(`${sitemap} [${i}..${i + batch.length}) -> ${res.status}`);
    if (res.status >= 400 && res.status !== 429) process.exitCode = 1;
    sent += batch.length;
  }
}
console.log(`submitted ${sent} urls`);
