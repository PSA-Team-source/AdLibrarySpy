// Renders the 20 static Meta (Facebook/Instagram) signup image ads from the LIVE app:
//   marketing/fb-images/iNN.jpg       1080x1350 (4:5, feeds)
//   marketing/fb-images/iNN_9x16.jpg  1080x1920 (stories/reels; key content inside the
//                                     safe zone: 14% from the top, 35% from the bottom)
//   marketing/fb-images/manifest.json  copy + every number shown and the page it came from
//   marketing/fb-images/contact_4x5.jpg / contact_9x16.jpg  QA sheets
//
// Every screen, product photo, ad creative and number is captured from production at
// run time (never typed in). Signs in as the screenshots account (SHOTS_EMAIL, default
// shots@marketlens.test) with a 30-minute session written straight to the DB and revoked
// at the end whatever happens — same as capture-landing.mjs / render-fb-video.mjs. Only
// element crops are kept, so the account's name, email and workspace never reach an ad.
// A missing value aborts the run rather than render an invented one.
//
// Needs: DATABASE_URL (or .env.local) — prod RDS via the .220 tunnel on local 15432 —
// and PLAYWRIGHT=<playwright package entry>. Python 3 + Pillow for the contact sheets.
//
//   node scripts/render-fb-images.mjs [--only=capture|render] [--ids=i01,i07]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BASE = process.env.CAPTURE_BASE || 'https://adlibraryspy.com';
const EMAIL = process.env.SHOTS_EMAIL || 'shots@marketlens.test';
const OUT = path.resolve(process.env.IMAGES_OUT || 'marketing/fb-images');
const WORK = path.resolve(process.env.IMAGES_WORK || path.join(OUT, '.work'));   // gitignored captures
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const only = arg('only') || '';
const ONLY_IDS = arg('ids') ? new Set(arg('ids').split(',')) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
fs.mkdirSync(WORK, { recursive: true });

// The stores whose shop dossier is captured. Picked for rich data across niches;
// each one is used by exactly one ad (see CONCEPTS).
const DOSSIERS = ['mellowsleep.com', 'resilia.shop', 'emmafy.com', 'glovbeauty.com', 'macorner.co', 'gymshark.com'];

function envFile() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
const must = (v, what) => {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v)) || (Array.isArray(v) && !v.length))
    throw new Error(`capture: ${what} missing — refusing to render an ad with an invented value`);
  return v;
};
const num = s => Number(String(s).replace(/[^0-9.]/g, ''));

// ---------------------------------------------------------------- capture ---
async function capture() {
  const DATABASE_URL = process.env.DATABASE_URL || envFile().DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pg = (await import('pg')).default;
  const db = new pg.Client({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false } });
  await db.connect();
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = (await db.query('SELECT id FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!user) throw new Error(`no user ${EMAIL}`);
  await db.query(`INSERT INTO sessions (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, now() + interval '30 minutes', 'render-fb-images')`, [user.id, hash]);

  const browser = await chromium.launch({ channel: 'chromium' });
  const D = { capturedAt: new Date().toISOString() };
  try {
    const context = async (width, height, scale) => {
      const ctx = await browser.newContext({  viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'reduce' });
      ctx.setDefaultNavigationTimeout(60_000);
      await ctx.addCookies([{ name: 'ml_session', value: token, url: BASE, httpOnly: true, secure: BASE.startsWith('https'), sameSite: 'Lax' }]);
      return ctx;
    };
    const settle = async page => {
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      for (let i = 0; i < 3; i++) {
        try {
          await page.evaluate(() => Promise.all([...document.images].filter(im => !im.complete || !im.naturalWidth)
            .map(im => new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 8000); }))));
          break;
        } catch { await page.waitForLoadState('load').catch(() => {}); }
      }
      await sleep(800);
    };
    // Lazy images only load once scrolled to; walk the page first.
    const walk = async page => {
      for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 700); await sleep(250); }
      await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main, [data-scroll], .overflow-y-auto').forEach(e => { e.scrollTop = 0; }); });
      await settle(page);
    };
    const shot = async (loc, name) => {
      await loc.scrollIntoViewIfNeeded();
      await sleep(150);
      await loc.screenshot({ path: path.join(WORK, `${name}.png`), animations: 'disabled' });
      return `${name}.png`;
    };
    const painted = loc => loc.evaluate(el => { const im = el.tagName === 'IMG' ? el : el.querySelector('img'); return !!im && im.complete && im.naturalWidth > 60; }).catch(() => false);
    const text = async loc => (await loc.innerText()).trim();
    const lines = s => s.split('\n').map(l => l.trim()).filter(Boolean);

    // ---- public pages -------------------------------------------------------
    const pub = await context(1280, 1400, 3);
    let page = await pub.newPage();

    // /vs/trendtrack — the comparison claims, read off the page itself.
    await page.goto(`${BASE}/vs/trendtrack`);
    await page.locator('table').first().waitFor({ timeout: 30_000 });
    const rows = await page.locator('table tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.innerText.trim())));
    const row = label => rows.find(r => r[0].toLowerCase().startsWith(label.toLowerCase()));
    const price = must(row('Price'), 'vs price row');
    const tiers = [...price[2].matchAll(/(Starter|Pro|Business) \$(\d+)/g)].map(m => ({ plan: m[1], usd: Number(m[2]) }));
    must(tiers.length === 3 ? tiers : null, 'TrendTrack tiers');
    const seats = must(row('Team seats'), 'seats row');
    const brand = must(row('Brand tracking'), 'brand tracking row');
    const lookups = must(row('Shop lookups'), 'lookups row');
    const body = await text(page.locator('body'));
    D.vs = {
      tiers, ours: price[1], theirsPrice: price[2],
      seatPrice: Number(must(seats[2].match(/\$(\d+) per seat/)?.[1], 'seat price')),
      ourSeats: seats[1], theirBrands: brand[2], ourBrands: brand[1], theirLookups: lookups[2], ourLookups: lookups[1],
      checked: must(body.match(/pricing page as checked on\s*([0-9]{1,2} \w+ \d{4})/)?.[1], 'vs checked date'),
      index: must(body.match(/Our index today:\s*([\d.]+ million)/)?.[1], 'index size'),
    };
    await page.close();

    // /weekly — the Monday report sections, parsed from the page.
    page = await pub.newPage();
    await page.goto(`${BASE}/weekly`);
    await page.locator('section[aria-labelledby^="s-"] li').first().waitFor({ timeout: 30_000 });
    await walk(page);
    D.weekly = { week: must(await text(page.locator('h1').first()), 'weekly title'), url: page.url().replace(BASE, '') };
    for (const key of ['scaling', 'growth', 'peaks', 'newest', 'movers']) D.weekly[key] = null;
    const sections = page.locator('section[aria-labelledby^="s-"]');
    for (let s = 0; s < await sections.count(); s++) {
      const sec = sections.nth(s);
      const title = await text(sec.locator('h2').first());
      const key = /scaling/i.test(title) ? 'scaling' : /traffic growth/i.test(title) ? 'growth' : /ad peaks/i.test(title) ? 'peaks'
        : /newest/i.test(title) ? 'newest' : /niche/i.test(title) ? 'movers' : /products/i.test(title) ? 'products' : null;
      if (!key) continue;
      const items = [];
      const lis = sec.locator('li');
      for (let i = 0; i < Math.min(await lis.count(), 10); i++) {
        const li = lis.nth(i);
        if (key === 'products') {
          const img = li.locator('img').first();
          if (!(await painted(img))) continue;
          const [title2, store] = lines(await text(li));
          items.push({ title: title2, store, img: await shot(img, `weekly_prod_${items.length}`) });
          continue;
        }
        const name = await text(li.locator('span.font-semibold').first());
        const metric = await text(li.locator('span.shrink-0.text-right').last());
        const detail = await text(li.locator('.line-clamp-2').first());
        const domain = await li.locator('a').first().getAttribute('href');
        const logo = li.locator('img').first();
        items.push({ name, metric, detail, domain: domain.replace(/^\/store\//, ''), logo: (await logo.count()) && (await painted(logo)) ? await shot(logo, `weekly_${key}_logo_${i}`) : null });
      }
      D.weekly[key] = items;
      if (key !== 'products') D.weekly[`${key}Source`] = (await text(sec.locator('p').last())).replace(/^Source:\s*/, '');
    }
    for (const k of ['scaling', 'peaks', 'newest']) must(D.weekly[k], `weekly ${k}`);
    await page.close();

    // /trending — niches and the products of the fastest-growing stores.
    page = await pub.newPage();
    await page.goto(`${BASE}/trending`);
    await page.locator('ol li h3').first().waitFor({ timeout: 45_000 });
    await walk(page);
    const niches = page.locator('ol > li:has(h3)');
    D.niches = [];
    for (let i = 0; i < Math.min(await niches.count(), 12); i++) {
      const li = niches.nth(i);
      const t = lines(await text(li));
      // [parent, name, #n, breakout, "stores grew 50%+", "31% of 647 measured stores", leader, +x%, ...]
      const m = t.join(' ').match(/([\d,]+)\s*stores grew (\d+)%\+\s*(\d+)% of ([\d,]+) measured stores/);
      if (!m) continue;
      D.niches.push({ parent: t[0], name: t[1], rank: i + 1, breakout: num(m[1]), minGrowth: Number(m[2]), share: Number(m[3]), measured: num(m[4]), card: await shot(li, `niche_${i}`) });
    }
    must(D.niches, 'trending niches');
    D.nichesPeriod = must((await text(page.locator('text=Share of each niche').first())).match(/, (.+)\.$/)?.[1], 'niche period');
    const tiles = page.locator('li:has(> a span.aspect-square img)');
    D.trendProducts = [];
    for (let i = 0; i < await tiles.count() && D.trendProducts.length < 12; i++) {
      const li = tiles.nth(i);
      const img = li.locator('img').first();
      await li.scrollIntoViewIfNeeded(); await sleep(200);
      if (!(await painted(img))) continue;
      const t = lines(await text(li));
      const growth = t.find(x => /^[+−-][\d,.]+%$/.test(x));
      if (!growth) continue;
      D.trendProducts.push({ title: t[0], store: t[1], growth, domain: (await li.locator('a').first().getAttribute('href')).replace(/^\/store\//, ''),
        img: await shot(li.locator('span.aspect-square').first(), `trend_prod_${D.trendProducts.length}`) });
    }
    if (D.trendProducts.length < 6) throw new Error(`capture: only ${D.trendProducts.length} trending products painted`);
    await page.close();
    await pub.close();

    // ---- signed-in app --------------------------------------------------------
    const desk = await context(1440, 1500, 3);
    page = await desk.newPage();
    await page.goto(`${BASE}/shops`);
    await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
    await settle(page);
    D.shopsIndexed = must(num(await text(page.locator('h1').first().locator('xpath=..'))), 'shops indexed');
    // The default view is ranked by Max Ads (7D). AOV is an estimate, so it is hidden
    // from the crop; the table otherwise stays exactly as the app renders it.
    const headers = await page.locator('thead th').evaluateAll(ths => ths.map(th => th.innerText.trim()));
    const col = h => headers.findIndex(x => x.startsWith(h));
    const keep = [col('Brand Info'), col('Monthly Traffic'), col('Growth Rate'), col('Ads')].map(i => i + 1);
    if (keep.some(i => i < 1)) throw new Error(`capture: shops headers changed: ${headers.join(' | ')}`);
    await page.addStyleTag({ content: `table tr > :not(${keep.map(i => `:nth-child(${i})`).join(',')}){display:none!important} table{width:auto!important;table-layout:auto!important} th,td{width:auto!important;min-width:0!important}` });
    await page.evaluate(() => { for (const tr of [...document.querySelectorAll('tbody tr')].slice(6)) tr.style.display = 'none'; });
    await sleep(500);
    // The table keeps its min-width; crop to the columns that are left.
    const tb = page.locator('table').first();
    await tb.scrollIntoViewIfNeeded();
    const clip = await tb.evaluate(t => {
      const b = t.getBoundingClientRect();
      const right = Math.max(...[...t.querySelectorAll('thead th')].filter(th => th.offsetParent).map(th => th.getBoundingClientRect().right));
      return { x: b.x, y: b.y, width: right - b.x + 12, height: b.height };
    });
    await page.screenshot({ path: path.join(WORK, 'shops_table.png'), clip, animations: 'disabled' });
    D.shopsTable = 'shops_table.png';
    // Where each kept column's header sits in the crop (fractions), for the ad's callouts.
    D.shopsCols = await tb.evaluate((t, c) => [...t.querySelectorAll('thead th')].filter(th => th.offsetParent)
      .map(th => { const r = th.getBoundingClientRect(); return { label: th.innerText.trim(), x: (r.x + r.width / 2 - c.x) / c.width, y: (r.bottom - c.y) / c.height }; }), clip);
    D.shopsRows = await page.locator('tbody tr').evaluateAll((trs, k) => trs.slice(0, 6).map(tr => k.map(i => tr.children[i - 1].innerText.trim().split('\n').map(s => s.trim()).filter(Boolean))), keep);
    await page.close();

    // Shop dossiers, single-column tablet width at 2x (1200px wide crops): chart labels
    // collide at phone width.
    const phone = await context(600, 3600, 2);
    D.stores = {};
    // Production occasionally stalls a page load; a dossier gets three tries.
    const retry = async (what, fn) => {
      for (let i = 1; ; i++) {
        try { return await fn(); } catch (e) { if (i >= 3) throw e; console.log(`  retry ${what}: ${e.message.split('\n')[0]}`); await sleep(3000); }
      }
    };
    for (const domain of DOSSIERS) await retry(domain, async () => {
      page = await desk.newPage();
      await page.goto(`${BASE}/shops?q=${encodeURIComponent(domain)}`);
      const r = page.locator('tbody tr', { hasText: domain }).first();
      await r.waitFor({ timeout: 30_000 });
      const href = await r.locator('a[href^="/shops/"]').first().getAttribute('href');
      await page.close();
      page = await phone.newPage();
      await page.goto(BASE + href);
      await page.locator('h1').first().waitFor({ timeout: 30_000 });
      await page.locator('#products img').first().waitFor({ timeout: 30_000 }).catch(() => {});
      await walk(page);
      const card = title => page.locator('div', { has: page.locator(`xpath=./div[normalize-space()="${title}"]`) }).last();
      const S = { domain, href, name: await text(page.locator('h1').first()) };
      const vt = lines(await text(card('Monthly Visits')));
      S.visits = must(vt.find(l => /^[\d.,]+[KMB]?$/.test(l)), `${domain} visits`);
      S.growth = vt.find(l => /^[+−-]\d+%$/.test(l)) || null;
      S.visitsSource = vt.find(l => /SimilarWeb/.test(l)) || null;
      S.visitsCard = await shot(card('Monthly Visits'), `${domain}_visits`);
      const tt = lines(await text(card('Traffic Over Time')));
      S.traffic = tt.filter(l => /^[\d.]+[KM]$/.test(l)).slice(-3);  // the point labels (the axis ticks come first)
      S.trafficCard = await shot(card('Traffic Over Time'), `${domain}_traffic`);
      const at = lines(await text(card('Live Ads Over Time')));
      S.liveAds = must(num(at[1]), `${domain} live ads`);
      S.adsCard = await shot(card('Live Ads Over Time'), `${domain}_liveads`);
      const prod = page.locator('#products');
      must(await prod.count() || null, `${domain} products panel`);
      const pt = lines(await text(prod));
      S.productCount = /^[\d,]+$/.test(pt[1] || '') ? num(pt[1]) : null;
      S.bestSellers = await prod.getByText('Best Seller', { exact: true }).count() > 0;
      S.productsCard = await shot(prod, `${domain}_products`);
      S.products = [];
      const pcards = prod.locator('div.min-w-0:has(img)');
      for (let i = 0; i < Math.min(await pcards.count(), 6); i++) {
        const pc = pcards.nth(i);
        const img = pc.locator('div.relative').first();
        if (!(await painted(img))) continue;
        const t = lines(await text(pc));
        // Checkout add-ons are not products anyone would sell.
        if (/shipping protection|package protection|gift card|insurance/i.test(t.join(' '))) continue;
        S.products.push({ title: t.find(x => !/^#\d+$/.test(x)), price: t.find(x => /^[$€£]|\d+\.\d\d$/.test(x)) || null,
          img: await shot(img, `${domain}_prod_${S.products.length}`) });
      }
      const pix = page.locator('div', { has: page.locator('xpath=./div[starts-with(normalize-space(),"Pixels")]') }).last();
      if (await pix.count()) {
        const t = lines(await text(pix));
        S.pixelCount = num(t[0]);
        const ai = t.findIndex(l => l.startsWith('Apps & Integrations'));
        S.pixels = t.slice(1, ai < 0 ? undefined : ai);
        // Apps & Integrations sits in the same card, below the pixels.
        const all = lines(await text(pix.locator('xpath=..')));
        const aj = all.findIndex(l => l.startsWith('Apps & Integrations'));
        S.appCount = aj < 0 ? null : num(all[aj]);
        S.apps = aj < 0 ? [] : all.slice(aj + 1);
        S.stackCard = await shot(pix.locator('xpath=..'), `${domain}_stack`);
      }
      D.stores[domain] = S;
      console.log(`  ${domain}: ${S.visits} visits ${S.growth ?? ''}, ${S.liveAds} ads, ${S.products.length} products, ${S.pixelCount ?? '-'} pixels`);
      await page.close();
    });
    await phone.close();

    // Brandtracker: shop info, traffic, live ads (the manage column is left out).
    page = await desk.newPage();
    await page.goto(`${BASE}/brandtracker`);
    await page.locator('tbody tr').first().waitFor({ timeout: 30_000 });
    await settle(page);
    const bt = page.locator('table').first();
    const bth = await bt.locator('thead th').evaluateAll(ths => ths.map(th => th.innerText.trim()));
    const bkeep = ['SHOP INFO', 'TRAFFIC', 'LIVE ADS', 'NEW ADS'].map(h => bth.findIndex(x => x.toUpperCase().startsWith(h)) + 1);
    if (bkeep.some(i => i < 1)) throw new Error(`capture: brandtracker headers changed: ${bth.join(' | ')}`);
    await page.addStyleTag({ content: `table tr > :not(${bkeep.map(i => `:nth-child(${i})`).join(',')}){display:none!important} table{width:auto!important}` });
    await sleep(400);
    D.tracker = await bt.locator('tbody tr').evaluateAll((trs, k) => trs.map(tr => k.map(i => tr.children[i - 1].innerText.trim().split('\n').map(s => s.trim()).filter(Boolean))), bkeep);
    D.trackerShot = await shot(bt, 'brandtracker');
    must(D.tracker.length >= 3 ? D.tracker : null, 'brandtracker rows');
    await page.close();

    // Advertisers: the page with the most live ads.
    page = await desk.newPage();
    await page.goto(`${BASE}/advertisers`);
    const adv = page.locator('article.card').first();
    await adv.waitFor({ timeout: 30_000 });
    await settle(page);
    const advT = lines(await text(adv));
    const ai = advT.findIndex(l => l === 'Ads launched');
    D.advertiser = {
      name: advT[0], firstAd: advT.find(l => l.startsWith('First ad')) || null,
      liveAds: must(num(advT.find(l => /^[\d,]{4,}$/.test(l))), 'advertiser live ads'),
      launched14: num(advT[ai - 1]), followers: advT[advT.findIndex(l => l === 'followers') - 1] || null,
      card: await shot(adv, 'advertiser'),
    };
    await page.close();

    // Ads library: media crops of the first creatives that painted.
    page = await desk.newPage();
    await page.goto(`${BASE}/ads`);
    await page.locator('article img').first().waitFor({ timeout: 30_000 });
    await settle(page);
    D.ads = [];
    const seen = new Set();
    for (let pg = 1; pg <= 5 && D.ads.length < 16; pg++) {
      if (pg > 1) { await page.goto(`${BASE}/ads?page=${pg}`); await page.locator('article img').first().waitFor({ timeout: 30_000 }); await settle(page); }
      const cards = page.locator('article');
      for (let i = 0; i < await cards.count() && D.ads.length < 16; i++) {
        const c = cards.nth(i);
        await c.scrollIntoViewIfNeeded(); await settle(page);
        const media = c.locator('a[aria-label^="Details of this ad"]').first();
        if (!(await media.count()) || !(await painted(media))) continue;
        const src = await media.locator('img').first().getAttribute('src');
        const advName = await text(c.locator('.text-sm.font-semibold').first()).catch(() => '');
        if (seen.has(src) || seen.has(advName)) continue;   // one creative per advertiser
        seen.add(src); seen.add(advName);
        D.ads.push({ advertiser: advName, img: await shot(media, `ad_${D.ads.length}`) });
      }
    }
    if (D.ads.length < 9) throw new Error(`capture: only ${D.ads.length} ad creatives painted`);
    await page.close();
    await desk.close();

    fs.writeFileSync(path.join(WORK, 'data.json'), JSON.stringify(D, null, 2));
    console.log(`captured → ${path.join(WORK, 'data.json')}`);
  } finally {
    await browser.close();
    await db.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hash]);
    await db.end();
    console.log('session revoked');
  }
}

if (only !== 'render') await capture();
if (only !== 'capture') await (await import('./fb-images-compose.mjs')).render({ WORK, OUT, chromium, ONLY_IDS });
