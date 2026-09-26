import {
  SITE, detectShopify, lookupHosts, apiUrl, safeHttps, withRef, signupUrl,
  compact, growthLabel, monthYear, flag,
} from './lib.js';

const app = document.getElementById('app');

/** Tiny DOM builder: text only ever goes in via textContent, never innerHTML. */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false || kid === '') continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/** An image that removes itself if it fails — never a broken or empty box. */
function img(src, attrs = {}) {
  const url = safeHttps(src);
  if (!url) return null;
  const n = el('img', { ...attrs, src: url, loading: 'lazy', referrerpolicy: 'no-referrer' });
  n.addEventListener('error', () => (n.closest('[data-drop-with-img]') || n).remove());
  return n;
}

const link = (href, cls, ...kids) => el('a', { href, class: cls, target: '_blank', rel: 'noopener' }, ...kids);

function render(...nodes) { app.replaceChildren(...nodes.filter(Boolean)); }

function emptyState(title, text, withDirectory = true) {
  render(
    el('section', { class: 'empty' }, el('h2', {}, title), el('p', {}, text)),
    withDirectory && el('div', { class: 'ctas' },
      link(withRef(`${SITE}/stores`), 'btn secondary', 'Browse the shops directory')),
  );
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function detect(tab) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: detectShopify });
  return res && res.result;
}

/** First host the API knows; { data:null } when none; throws on a transport or server failure. */
async function lookup(hosts) {
  for (const host of hosts) {
    const res = await fetch(apiUrl(host), { headers: { Accept: 'application/json' } });
    if (res.status === 404 || res.status === 400) continue;
    if (res.status === 429) throw new Error('Too many lookups in a minute — try again shortly.');
    if (!res.ok) throw new Error('AdLibrarySpy could not load this store right now. Try again in a moment.');
    return { host, data: await res.json() };
  }
  return { data: null };
}

function tile(label, value, extra, caption, small) {
  return el('div', { class: 'tile' },
    el('div', { class: 'k' }, label),
    el('div', { class: small ? 'v sm' : 'v' }, value, extra),
    caption && el('div', { class: 'cap' }, caption));
}

function storeCard(s, shopifyDetected) {
  const tiles = [];
  if (s.traffic && s.traffic.visits > 0) {
    const g = growthLabel(s.traffic.growthPct);
    tiles.push(tile('Monthly visits', compact(s.traffic.visits),
      g && el('span', { class: `chip ${s.traffic.growthPct > 0 ? 'up' : 'down'}` }, g),
      s.traffic.sourceLabel));
  }
  if (s.metaAds && s.metaAds.live) tiles.push(tile('Live Meta ads', s.metaAds.live.toLocaleString('en-US')));
  else if (s.metaAds && s.metaAds.inLibrary) tiles.push(tile('Meta ads in library', s.metaAds.inLibrary.toLocaleString('en-US')));
  const created = monthYear(s.createdOn);
  if (created) tiles.push(tile('Store created', created, null, null, true));
  if (s.country) tiles.push(tile('Country', `${flag(s.country)} ${s.country}`.trim(), null, null, true));

  const products = (s.products || []).map(p => {
    const pic = img(p.image, { alt: '' });
    return pic && el('div', { class: 'product', 'data-drop-with-img': '' }, pic, el('span', { title: p.title }, p.title));
  }).filter(Boolean);

  const tech = [...(s.pixels || []), ...(s.apps || [])];
  const shown = tech.slice(0, 10);

  const analysis = safeHttps(s.urls && s.urls.analysis);
  const appUrl = safeHttps(s.urls && s.urls.app);
  const platform = s.platform === 'shopify' || shopifyDetected ? 'Shopify' : null;

  render(
    el('section', { class: 'store' },
      img(s.logo, { alt: '' }),
      el('div', { class: 'id' },
        el('h1', { title: s.name }, s.name || s.domain),
        el('div', { class: 'sub' }, s.domain, platform && el('span', { class: 'tag' }, platform)))),
    s.niche && s.niche.length > 0 && el('div', { class: 'niche' }, s.niche.join(' › ')),
    tiles.length > 0 && el('section', { class: 'grid' }, tiles),
    el('section', { class: 'ctas' },
      analysis && link(withRef(analysis), 'btn primary', 'Open full analysis →'),
      link(signupUrl(appUrl), 'btn secondary', 'Track this brand (free)')),
    products.length > 0 && el('section', { class: 'section' }, el('h3', {}, 'Top products'), el('div', { class: 'products' }, products)),
    shown.length > 0 && el('section', { class: 'section' },
      el('h3', {}, 'Apps & pixels', el('span', {}, String(tech.length))),
      el('div', { class: 'chips' }, shown.map(t => el('span', {}, t)),
        tech.length > shown.length && el('span', {}, `+${tech.length - shown.length} more`))),
    el('p', { class: 'foot' }, 'Figures from AdLibrarySpy’s market index. Each traffic figure names its source.'),
  );
}

async function main() {
  const tab = await activeTab();
  if (!tab || !/^https?:\/\//.test(tab.url || '')) {
    return emptyState('Open a store to inspect it', 'Visit any online store, then click the AdLibrarySpy icon to see its traffic, Meta ads, products and apps.');
  }
  let detected;
  try {
    detected = await detect(tab);
  } catch {
    return emptyState('This page can’t be inspected', 'Chrome doesn’t let extensions read this page. Open a store’s website and try again.');
  }
  if (!detected) return emptyState('This page can’t be inspected', 'Reload the page and try again.');

  const hosts = lookupHosts(detected);
  if (!hosts.length) return emptyState('Not a public store', 'This page isn’t on a public website address, so there is nothing to look up.');

  let result;
  try {
    result = await lookup(hosts);
  } catch (err) {
    return emptyState('Couldn’t load store data', err instanceof Error && err.message ? err.message : 'Try again in a moment.', false);
  }

  if (!result.data) {
    return detected.shopify
      ? emptyState('Shopify store — not indexed yet', `${hosts[0]} runs on Shopify, but AdLibrarySpy has no data for it yet.`)
      : emptyState('Not a Shopify store', `${hosts[0]} doesn’t look like a Shopify store, and it isn’t in AdLibrarySpy’s index.`);
  }
  storeCard(result.data, detected.shopify);
}

main().catch(() => emptyState('Something went wrong', 'Close this popup and try again.', false));
