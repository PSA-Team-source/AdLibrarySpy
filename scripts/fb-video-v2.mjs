// The v2 set of Meta signup video ads: 20 distinct creatives built from a few
// creative ANGLES (hook, scene order, end-card line, music) crossed with real
// stores. Output: marketing/fb-video/v2/v01.mp4 … v20.mp4 (+ .jpg thumbnails and
// manifest.json with the ad copy and the source of every number on screen).
//
// Capture (production, signed in as the screenshots account via fb-video-prod.mjs):
//   per store  → v2/.work/cap/<domain>/  Shops row, dossier cards (visits, traffic,
//                ad-count chart, products), the store's own ads when the library has them
//   shared     → v2/.work/cap/_shared/   ads library wall, Brandtracker, Trends risers,
//                Advertisers leader, /vs/trendtrack rows, size of the shop index
// Every figure is read from the page and the capture aborts on a missing one.
// Stores already captured are kept (delete the folder or pass --fresh to redo).
//
// Render: fb-video-angles.mjs composes each video in its own work dir
// (v2/.work/vNN/) and encodes it to <= 9 MB.
//
//   node scripts/fb-video-v2.mjs [--set=home] [--only=capture|render] [--ids=v01,v05] [--fresh]
import fs from 'node:fs';
import path from 'node:path';
import { withProd, BASE, sleep } from './fb-video-prod.mjs';

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
// --set=home: the homepage hero loop (HOME in fb-video-angles.mjs), written
// straight into public/landing with its own capture dir and manifest.
const home = arg('set') === 'home';
const OUT = path.resolve(process.env.VIDEO_OUT || (home ? 'public/landing' : 'marketing/fb-video/v2'));
const WORK = path.resolve(process.env.VIDEO_WORK || (home ? 'marketing/fb-video/home/.work' : path.join(OUT, '.work')));
const CAP = path.join(WORK, 'cap');
const only = arg('only') || '';
const ids = arg('ids') ? arg('ids').split(',') : null;
const fresh = process.argv.includes('--fresh');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const { VIDEOS: ADS, HOME, render } = await import('./fb-video-angles.mjs');
const VIDEOS = home ? HOME : ADS;

const need = (v, what) => { if (v == null || v === '' || Number.isNaN(v)) throw new Error(`capture: ${what} missing — refusing to render an invented value`); return v; };
const num = s => Number(String(s).replace(/[^0-9.]/g, ''));

// ------------------------------------------------------------ one store ---
async function captureStore(h, store) {
  const { context, settle, shot, clipShot, rectIn, boxOf, text } = h;
  const data = { store, capturedAt: new Date().toISOString(), rings: {} };

  // Shops row (desktop, 3x): the store, its traffic, growth and live ads.
  const desk = await context(1440, 1400, 3);
  let page = await desk.newPage();
  await page.goto(`${BASE}/shops?q=${encodeURIComponent(store)}`);
  const row = page.locator('tbody tr', { hasText: store }).first();
  await row.waitFor({ timeout: 30_000 });
  await settle(page);
  const cols = page.locator('thead tr').first().locator('th');
  const heads = (await cols.allInnerTexts()).map(s => s.trim().toLowerCase());
  const col = re => { const i = heads.findIndex(x => re.test(x)); if (i < 0) throw new Error(`shops: no ${re} column in ${heads}`); return i; };
  const cT = col(/traffic|visits/), cG = col(/growth/), cA = heads.findIndex(x => /^ads|live ads/.test(x));
  const tds = row.locator('td');
  data.row = { traffic: (await text(tds.nth(cT))).split('\n')[0], growth: (await text(tds.nth(cG))).split('\n')[0], ads: (await text(tds.nth(cA))).split('\n')[0] };
  await clipShot(page, page.locator('thead tr').first(), 'shop_head', cols.nth(1), cols.nth(cA));
  const rowClip = await clipShot(page, row, 'shop_row', cols.nth(1), cols.nth(cA));
  // Ring the figure itself: the cell's first leaf with text (the date line under it stays out).
  const leaf = async td => { const l = td.locator('xpath=(.//*[not(*) and normalize-space()])[1]'); return (await l.count()) ? l : td; };
  data.rings.rowTraffic = await rectIn(rowClip, await leaf(tds.nth(cT)));
  data.rings.rowGrowth = await rectIn(rowClip, await leaf(tds.nth(cG)));
  data.rings.rowAds = await rectIn(rowClip, await leaf(tds.nth(cA)));
  const dossier = await row.locator('a[href^="/shops/"]').first().getAttribute('href');
  data.dossier = BASE + dossier;
  await page.close();

  // The store's own creatives, when the ads index has them (else the video uses the library wall).
  page = await desk.newPage();
  await page.goto(`${BASE}/ads?store=${encodeURIComponent(store)}&sort=newest`);
  await page.locator('article img').first().waitFor({ timeout: 20_000 }).catch(() => {});
  await settle(page);
  let kept = 0;
  const cards = page.locator('article');
  for (let i = 0, n = await cards.count(); i < n && kept < 10; i++) {
    const card = cards.nth(i);
    await card.scrollIntoViewIfNeeded();
    await settle(page);
    if (!(await card.evaluate(el => [...el.querySelectorAll('img')].some(im => im.naturalWidth > 200)))) continue;
    await shot(card, `ad_${kept++}`);
  }
  data.ownAds = kept;
  await page.close();
  await desk.close();

  // Dossier (phone, 3x = 1290px wide), card by card.
  const phone = await context(430, 3200, 3);
  page = await phone.newPage();
  await page.goto(BASE + dossier);
  await page.locator('h1').first().waitFor({ timeout: 30_000 });
  await page.locator('#products img').first().waitFor({ timeout: 30_000 }).catch(() => {});
  await settle(page);
  const card = title => page.locator('div', { has: page.locator(`xpath=./div[normalize-space()="${title}"]`) }).last();
  data.storeName = await text(page.locator('h1').first());
  const h1 = await page.locator('h1').first().boundingBox();
  const nav = await page.locator('nav[aria-label="Shop detail sections"]').boundingBox();
  await page.screenshot({ path: path.join(h.dir, 'dossier_head.png'), clip: { x: 0, y: h1.y - 28, width: 430, height: nav.y - h1.y + 12 } });
  const visits = card('Monthly Visits');
  await shot(visits, 'visits');
  const vBox = await boxOf(visits);
  data.rings.visits = await rectIn(vBox, visits.locator('.text-2xl').first());
  const vt = await text(visits);
  data.visits = vt.match(/([\d.,]+[KMB]?)/)?.[1] ?? null;
  data.visitsGrowth = vt.match(/([+\-−]\d+%)/)?.[1] ?? null;
  data.visitsSource = vt.split('\n').find(l => /SimilarWeb|estimate/i.test(l))?.trim() ?? null;
  const badge = visits.getByText(/^[+\-−]\d+%$/).first();
  if (await badge.count()) data.rings.visitsGrowth = await rectIn(vBox, badge);
  // Series straight from the chart's own point labels ("Aug 2026: Visits 2,127,000").
  const series = async loc => (await loc.locator('[tabindex="0"][aria-label]').evaluateAll(els => els.map(e => e.getAttribute('aria-label'))))
    .map(l => { const m = l.match(/^(.*?):.*?([\d,]+)\s*$/); return m && { t: m[1].trim(), v: Number(m[2].replace(/,/g, '')) }; }).filter(Boolean);
  const traffic = card('Traffic Over Time');
  await shot(traffic, 'traffic');
  data.trafficSeries = await series(traffic);
  const ads = card('Live Ads Over Time');
  await shot(ads, 'liveads');
  data.rings.liveads = await rectIn(await boxOf(ads), ads.locator('.text-2xl').first());
  data.liveAds = Number((await text(ads)).split('\n')[1].replace(/[^0-9]/g, '')) || null;
  data.liveAdsSeries = await series(ads);
  const products = page.locator('#products');
  if (await products.count()) {
    await shot(products, 'products');
    data.bestSellers = await products.getByText('Best Seller', { exact: true }).count() > 0;
    data.products = await products.locator('.grid > div').evaluateAll(els => els.slice(0, 6).map(e => ({
      rank: Number(e.querySelector('span.absolute')?.textContent.replace('#', '')) || null,
      title: e.querySelector('.truncate')?.getAttribute('title') || '',
      price: e.querySelector('.text-sm.font-semibold')?.textContent.trim() || null,
    })));
    await shot(products.locator('.grid > div').first().locator('div.relative').first(), 'product_1');
  }
  await page.close();
  await phone.close();

  need(data.liveAds, `${store} liveAds`); need(data.visits, `${store} visits`); need(data.storeName, `${store} storeName`);
  need(data.row.ads, `${store} row ads`); need(data.row.traffic, `${store} row traffic`);
  if (data.liveAdsSeries.length < 2) throw new Error(`capture: ${store} ad-count series has ${data.liveAdsSeries.length} points`);
  return data;
}

// --------------------------------------------------------------- shared ---
async function captureShared(h) {
  const { context, settle, shot, clipShot, rectIn, text } = h;
  const data = { capturedAt: new Date().toISOString(), rings: {} };
  const desk = await context(1440, 1400, 3);

  let page = await desk.newPage();
  await page.goto(`${BASE}/shops`);
  await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
  await settle(page);
  data.shopsIndexed = need(Number((await text(page.locator('h1').first().locator('xpath=..'))).replace(/[^0-9]/g, '')) || null, 'shopsIndexed');
  await page.close();

  // Ads library wall: the first pages of live creatives, only ones whose media painted.
  page = await desk.newPage();
  await page.goto(`${BASE}/ads`);
  await page.locator('article img').first().waitFor({ timeout: 30_000 });
  await settle(page);
  let kept = 0;
  for (let pg = 0; pg < 4 && kept < 16; pg++) {
    if (pg) {
      const next = page.getByRole('button', { name: /^Next/ }).or(page.getByRole('link', { name: /^Next/ })).first();
      if (!(await next.isEnabled().catch(() => false))) break;
      await next.click(); await sleep(1500); await settle(page);
    }
    const cards = page.locator('article');
    for (let i = 0, n = await cards.count(); i < n && kept < 16; i++) {
      const c = cards.nth(i);
      await c.scrollIntoViewIfNeeded(); await settle(page);
      if (!(await c.evaluate(el => [...el.querySelectorAll('img')].some(im => im.naturalWidth > 200)))) continue;
      await shot(c, `lib_${kept++}`);
    }
  }
  data.libAds = kept;
  if (kept < 8) throw new Error(`capture: only ${kept} library creatives painted`);
  await page.close();

  // Brandtracker: shop, traffic, live ads, new ads.
  page = await desk.newPage();
  await page.goto(`${BASE}/brandtracker`);
  await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
  await settle(page);
  const bt = page.locator('table').first();
  const bcols = bt.locator('thead th');
  const bClip = await clipShot(page, bt, 'brandtracker', bcols.nth(0), bcols.nth(3), 20);
  data.rings.tracker = await rectIn(bClip, bt.locator('tbody tr').first().locator('td').nth(2));
  data.tracker = await bt.locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.querySelectorAll('td')].slice(0, 4).map(td => td.innerText.trim().split('\n')[0])));
  if (data.tracker.length < 3) throw new Error('capture: brandtracker has < 3 brands');
  await page.close();

  // Trends and /vs sit below the fold of a 1400px window: crop them from a tall one.
  const tall = await context(1440, 3000, 3);
  // Trends: fastest-growing stores (SimilarWeb month over month), top rows.
  page = await tall.newPage();
  await page.goto(`${BASE}/trends`);
  const risers = page.locator('section, div', { has: page.getByText('Fastest-growing stores', { exact: true }) }).locator('table').last();
  await risers.locator('tbody tr').first().waitFor({ timeout: 45_000 });
  await risers.scrollIntoViewIfNeeded();
  await settle(page);
  data.risers = await risers.locator('tbody tr').evaluateAll(rs => rs.slice(0, 5).map(r => [...r.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g, ' '))));
  data.risersPeriod = (await text(page.getByText(/Month-over-month SimilarWeb visits/).first())).replace(/\s+/g, ' ');
  const rb = await risers.boundingBox(), r5 = await risers.locator('tbody tr').nth(4).boundingBox();
  await page.screenshot({ path: path.join(h.dir, 'risers.png'), clip: { x: rb.x, y: rb.y, width: rb.width, height: r5.y + r5.height - rb.y } });
  console.log('  risers.png');
  await page.close();

  // Advertisers: the page with the most live ads.
  page = await tall.newPage();
  await page.goto(`${BASE}/advertisers`);
  await page.getByText(/^First ad/).first().waitFor({ timeout: 45_000 });
  await settle(page);
  const advCard = page.getByText(/^First ad/).first().locator('xpath=ancestor::div[.//*[normalize-space()="Shop Analytics"]][1]');
  await shot(advCard, 'advertiser');
  data.advertiser = (await text(advCard)).split('\n').map(s => s.trim()).filter(Boolean);
  await page.close();

  // /vs/trendtrack (public): the rows the price angle quotes, straight from the page.
  page = await tall.newPage();
  await page.goto(`${BASE}/vs/trendtrack`);
  const vt = page.locator('table').first();
  await vt.waitFor({ timeout: 30_000 });
  await settle(page);
  const vsRow = async feature => {
    const r = vt.locator('tbody tr', { has: page.getByText(feature, { exact: true }) }).first();
    return (await r.locator('td').allInnerTexts()).map(s => s.trim());
  };
  data.vs = { price: await vsRow('Price'), lookups: await vsRow('Shop lookups'), brands: await vsRow('Brand tracking'), seats: await vsRow('Team seats') };
  data.vsChecked = (await text(page.getByText(/as checked on/).first())).match(/checked on ([^.]+)/)?.[1] ?? null;
  const head = vt.locator('thead'), price = vt.locator('tbody tr').first();
  const hb = await head.boundingBox(), pb = await price.boundingBox();
  await page.screenshot({ path: path.join(h.dir, 'vs_price.png'), clip: { x: hb.x, y: hb.y, width: hb.width, height: pb.y + pb.height - hb.y } });
  console.log('  vs_price.png');
  await page.close();
  await tall.close();
  await desk.close();

  // The price angle quotes these exact figures; abort if the page no longer says them.
  const p = data.vs.price.join(' ');
  for (const s of ['$49', '$89', '$159', 'Free']) if (!p.includes(s)) throw new Error(`capture: /vs/trendtrack price row lacks ${s}: ${p}`);
  need(data.vsChecked, 'vs checked date');
  need(data.advertiser.length > 3 ? data.advertiser : null, 'advertiser card');
  return data;
}

// -------------------------------------------------------------- capture ---
async function capture() {
  const wanted = VIDEOS.filter(v => !ids || ids.includes(v.id));
  const stores = [...new Set(wanted.map(v => v.store).filter(Boolean))];
  const todo = ['_shared', ...stores].filter(s => fresh || !fs.existsSync(path.join(CAP, s, 'data.json')));
  if (!todo.length) return console.log('captures up to date');
  // One DB session per batch of four, so no batch outlives its 30 minutes.
  for (let i = 0; i < todo.length; i += 4) {
    await withProd({ chromium, dir: CAP }, async h => {
      for (const s of todo.slice(i, i + 4)) {
        h.dir = path.join(CAP, s);
        fs.rmSync(h.dir, { recursive: true, force: true });
        fs.mkdirSync(h.dir, { recursive: true });
        console.log(`# ${s}`);
        const data = s === '_shared' ? await captureShared(h) : await captureStore(h, s);
        fs.writeFileSync(path.join(h.dir, 'data.json'), JSON.stringify(data, null, 2));
      }
    });
  }
}

fs.mkdirSync(CAP, { recursive: true });
if (only !== 'render') await capture();
if (only !== 'capture') await render({ CAP, WORK, OUT, FFMPEG, chromium, ids, videos: VIDEOS, manifestFile: home ? path.resolve('marketing/fb-video/homepage.json') : undefined });
