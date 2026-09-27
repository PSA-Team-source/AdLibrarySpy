// Renders the Meta (Facebook/Instagram) signup video ad from the LIVE app:
//   marketing/fb-video/als_video_9x16.mp4  1080x1920, 30fps, H.264 + AAC
//   marketing/fb-video/als_video_4x5.mp4   1080x1350, same story re-laid out for feeds
//   marketing/fb-video/thumb_9x16.jpg / thumb_4x5.jpg
//
// Every screen and number in the ad is captured from production at run time
// (never typed in): the store's live Meta ads, monthly visits, growth, best
// sellers, the Brandtracker table, the ads library and the size of the shop
// index. Signs in as the dedicated screenshots account (SHOTS_EMAIL, default
// shots@marketlens.test) with a 30-minute session written straight to the DB
// and revoked at the end whatever happens — same as capture-landing.mjs. Only
// element crops are kept, so the test account's name never reaches a frame.
//
// Motion typography is an HTML page driven frame by frame (renderAt(t)) and
// screenshotted, so every frame is deterministic; the music is synthesized by
// ffmpeg's own sources (no samples, no third-party audio).
//
// Needs: DATABASE_URL (or .env.local) — prod RDS via the .220 tunnel on 15432,
// PLAYWRIGHT=<playwright package entry>, FFMPEG=<ffmpeg with libx264, aac>.
//
//   node scripts/render-fb-video.mjs [--store=comfrt.com] [--only=capture|render]
import fs from 'node:fs';
import path from 'node:path';
import { withProd, BASE } from './fb-video-prod.mjs';

const OUT = path.resolve(process.env.VIDEO_OUT || 'marketing/fb-video');
const WORK = path.resolve(process.env.VIDEO_WORK || path.join(OUT, '.work'));   // gitignored captures
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const STORE = arg('store') || 'comfrt.com';
const only = arg('only') || '';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, DUR = 18;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
fs.mkdirSync(WORK, { recursive: true });

// ---------------------------------------------------------------- capture ---
async function capture() {
  const data = { store: STORE, capturedAt: new Date().toISOString() };
  await withProd({ chromium, dir: WORK }, async ({ context, settle, shot, clipShot, rectIn, boxOf, text }) => {
    // -- desktop, 3x: shop row, brandtracker, ads library, index size
    const desk = await context(1440, 1400, 3);
    let page = await desk.newPage();
    await page.goto(`${BASE}/shops`);
    await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
    await settle(page);
    // "Shops 14,738,862" — the headline count of the index.
    data.shopsIndexed = Number((await text(page.locator('h1').first().locator('xpath=..'))).replace(/[^0-9]/g, '')) || null;
    await page.goto(`${BASE}/shops?q=${encodeURIComponent(STORE)}`);
    const row = page.locator('tbody tr', { hasText: STORE }).first();
    await row.waitFor({ timeout: 30_000 });
    await settle(page);
    const head = page.locator('thead tr').first();
    const cols = head.locator('th');
    // Brand Info .. Ads (drop rank, max-ads and top-products; the rest is the story).
    await clipShot(page, head, 'shop_head', cols.nth(1), cols.nth(5));
    const rowClip = await clipShot(page, row, 'shop_row', cols.nth(1), cols.nth(5));
    data.rings = { shopTraffic: await rectIn(rowClip, row.locator('td').nth(2)), shopAds: await rectIn(rowClip, row.locator('td').nth(5)) };
    const dossier = await row.locator('a[href^="/shops/"]').first().getAttribute('href');
    await page.close();

    page = await desk.newPage();
    await page.goto(`${BASE}/brandtracker`);
    await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
    await settle(page);
    const btable = page.locator('table').first();
    const bcols = btable.locator('thead th');
    const bClip = await clipShot(page, btable, 'brandtracker', bcols.nth(0), bcols.nth(2), 20);
    data.rings.tracker = await rectIn(bClip, btable.locator('tbody tr').first().locator('td').nth(2));
    await page.close();

    page = await desk.newPage();
    await page.goto(`${BASE}/ads`);
    await page.locator('article img').first().waitFor({ timeout: 30_000 });
    await settle(page);
    // The first pages of the live library, until there are 12 creatives for the wall.
    let kept = 0;
    for (let pg = 0; pg < 4 && kept < 12; pg++) {
      if (pg) {
        const next = page.getByRole('button', { name: /^Next/ }).or(page.getByRole('link', { name: /^Next/ })).first();
        if (!(await next.isEnabled().catch(() => false))) break;
        await next.click();
        await sleep(1500);
        await settle(page);
      }
      const cards = page.locator('article');
      const n = await cards.count();
      for (let i = 0; i < n && kept < 12; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        await settle(page);
        // Only creatives whose media actually painted (absent media = absent tile).
        const ok = await card.evaluate(el => [...el.querySelectorAll('img')].some(im => im.naturalWidth > 200));
        if (!ok) continue;
        await shot(card, `ad_${kept++}`);
      }
    }
    data.adCards = kept;
    await page.close();
    await desk.close();

    // -- phone, 3x (1290px wide): the store's dossier, card by card
    const phone = await context(430, 3200, 3);
    page = await phone.newPage();
    await page.goto(BASE + dossier);
    await page.locator('h1').first().waitFor({ timeout: 30_000 });
    await page.locator('#products img').first().waitFor({ timeout: 30_000 }).catch(() => {});
    await settle(page);
    const card = title => page.locator('div', { has: page.locator(`xpath=./div[normalize-space()="${title}"]`) }).last();
    data.storeName = await text(page.locator('h1').first());
    // Header: title + meta strip (Save/Tracking buttons live between them on phones; the whole block is kept).
    const h1 = await page.locator('h1').first().boundingBox();
    const nav = await page.locator('nav[aria-label="Shop detail sections"]').boundingBox();
    await page.screenshot({ path: path.join(WORK, 'dossier_head.png'), clip: { x: 0, y: h1.y - 28, width: 430, height: nav.y - h1.y + 12 } });
    const visits = card('Monthly Visits');
    await shot(visits, 'visits');
    data.rings.visits = await rectIn(await boxOf(visits), visits.locator('.text-2xl').first());
    const vt = await text(visits);
    data.visits = vt.match(/([\d.,]+[KMB]?)/)?.[1] ?? null;
    data.visitsGrowth = vt.match(/([+-−]\d+%)/)?.[1] ?? null;
    data.visitsSource = vt.split('\n').find(l => /SimilarWeb|estimate/i.test(l))?.trim() ?? null;
    await shot(card('Traffic Over Time'), 'traffic');
    const ads = card('Live Ads Over Time');
    await shot(ads, 'liveads');
    data.rings.liveads = await rectIn(await boxOf(ads), ads.locator('.text-2xl').first());
    data.liveAds = Number((await text(ads)).split('\n')[1].replace(/[^0-9]/g, '')) || null;
    await shot(page.locator('#products'), 'products');
    // Ranked best sellers only when the store exposes them; else the panel is the storefront's own order.
    data.bestSellers = await page.locator('#products').getByText('Best Seller', { exact: true }).count() > 0;
    await page.close();
    await phone.close();

    for (const k of ['liveAds', 'visits', 'storeName']) if (!data[k]) throw new Error(`capture: ${k} missing — refusing to render a video with an invented value`);
    if (data.adCards < 6) throw new Error(`capture: only ${data.adCards} ad creatives painted`);
    fs.writeFileSync(path.join(WORK, 'data.json'), JSON.stringify(data, null, 2));
    console.log(data);
  });
}

if (only !== 'render') await capture();
if (only !== 'capture') await (await import('./fb-video-compose.mjs')).render({ WORK, OUT, FFMPEG, FPS, DUR, chromium });
