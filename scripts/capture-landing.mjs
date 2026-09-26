// Re-captures the homepage media in public/landing from the LIVE app, so the
// homepage always shows the product as it is (never a mock-up):
//   stills  — shops, dossier, ads, brandtracker, weekly (2000px WebP)
//   hero    — flow.webm / flow.mp4 / flow-poster.webp (1440x790 walkthrough)
//
// Signs in as the dedicated screenshots account (SHOTS_EMAIL, default
// shots@marketlens.test — workspace "Growth team", 4 tracked brands) with a
// 30-minute session written straight to the DB, and revokes it at the end
// whatever happens. Needs: DATABASE_URL (or .env.local), a Playwright install
// (PLAYWRIGHT=<path to the playwright package> if it is not resolvable here),
// ffmpeg with libx264 + libvpx-vp9 (FFMPEG=<path> to override)
// and cwebp on PATH.
//
//   node scripts/capture-landing.mjs [--only=stills|video]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const BASE = process.env.CAPTURE_BASE || 'https://adlibraryspy.com';
const EMAIL = process.env.SHOTS_EMAIL || 'shots@marketlens.test';
const OUT = path.resolve('public/landing');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
// Captured at 1680x922 so the whole Shops table fits beside the sidebar, then
// scaled: stills to 2000px, the hero video to the page's 1440x790 frame.
const CW = 1680, CH = 922, W = 1440, H = 790;

function envFile() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
const DATABASE_URL = process.env.DATABASE_URL || envFile().DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const db = new pg.Client({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false } });
await db.connect();
const token = crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(token).digest('hex');
const user = (await db.query('SELECT id FROM users WHERE email = $1', [EMAIL])).rows[0];
if (!user) throw new Error(`no user ${EMAIL}`);
await db.query(
  `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, now() + interval '30 minutes', 'capture-landing')`,
  [user.id, hash],
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-'));
// Full Chromium, not the headless shell: the shell exited (code 0) mid-capture.
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const context = async scale => {
    const ctx = await browser.newContext({ viewport: { width: CW, height: CH }, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'no-preference' });
    await ctx.addCookies([{ name: 'ml_session', value: token, url: BASE, httpOnly: true, secure: BASE.startsWith('https'), sameSite: 'Lax' }]);
    return ctx;
  };
  // Every data screen settles when its table/grid has rows and images have painted.
  const settle = async page => {
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    // A page may swap its document mid-wait (e.g. /weekly's in-place URL
    // update); the wait is then simply retried on the settled document.
    for (let i = 0; i < 3; i++) {
      try {
        await page.evaluate(() => Promise.all([...document.images].filter(im => !im.complete)
          .map(im => new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 8000); }))));
        break;
      } catch { await page.waitForLoadState('load').catch(() => {}); }
    }
    await sleep(600);
  };
  const shopRows = page => page.locator('tbody tr').first().waitFor({ timeout: 30_000 });

  // The dossier still is Gymshark, as before; its id comes from the live index.
  async function dossierPath(page) {
    await page.goto(`${BASE}/shops?q=gymshark`);
    await shopRows(page);
    const href = await page.locator('tbody tr a[href^="/shops/"]').first().getAttribute('href');
    if (!href) throw new Error('gymshark not found in /shops');
    return href;
  }

  if (only !== 'video') {
    const ctx = await context(2);
    const probe = await ctx.newPage();
    const dossier = await dossierPath(probe);
    await probe.close();
    const stills = [
      ['shops', '/shops', shopRows],
      ['dossier', dossier, p => p.locator('h1').first().waitFor({ timeout: 30_000 })],
      ['ads', '/ads', p => p.locator('a[href^="/ads/"] img').first().waitFor({ timeout: 30_000 })],
      ['brandtracker', '/brandtracker', p => p.locator('tbody tr').first().waitFor({ timeout: 30_000 })],
      ['weekly', '/weekly', p => p.locator('h1').first().waitFor({ timeout: 30_000 })],
    ];
    // A fresh tab per still: five 2x pages in one tab ran the renderer out of memory.
    for (const [name, url, ready] of stills) {
      const page = await ctx.newPage();
      await page.goto(BASE + url);
      await ready(page);
      await settle(page);
      const png = path.join(tmp, `${name}.png`);
      await page.screenshot({ path: png });
      run('cwebp', ['-quiet', '-q', '82', '-resize', '2000', '0', png, '-o', path.join(OUT, `${name}.webp`)]);
      console.log(`still ${name}.webp  <- ${url}`);
      await page.close();
    }
    await ctx.close();
  }

  if (only !== 'stills') {
    const ctx = await context(1);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/shops`);
    await shopRows(page);
    await settle(page);

    // CDP screencast: full-quality JPEG frames with their own timestamps
    // (Playwright's recordVideo is a fixed low-bitrate VP8 and reads blurry).
    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', async f => {
      const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, t: f.metadata.timestamp });
      await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: CW, maxHeight: CH, everyNthFrame: 1 });

    const click = async loc => { await loc.hover(); await sleep(350); await loc.click(); };
    const rowsChange = async () => { await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {}); await settle(page); };

    // The walkthrough: opens on Max Ads (7D), switches platform, narrows to a
    // category, re-sorts by traffic, then opens a shop's analytics.
    await sleep(1800);
    await click(page.getByRole('button', { name: 'WooCommerce', exact: true }));
    await rowsChange(); await sleep(1600);
    await click(page.getByRole('button', { name: 'Shopify', exact: true }));
    await rowsChange(); await sleep(900);
    await click(page.getByRole('button', { name: 'Apparel', exact: true }));
    await rowsChange(); await sleep(1600);
    await click(page.getByRole('button', { name: /Monthly Traffic/ }));
    await rowsChange(); await sleep(1600);
    await click(page.locator('tbody tr a[href^="/shops/"]').first());
    await page.waitForURL(/\/shops\/[^/?]+$/, { timeout: 30_000 });
    await settle(page); await sleep(1400);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 140); await sleep(260); }
    await sleep(1600);
    await cdp.send('Page.stopScreencast');
    await sleep(300);

    if (frames.length < 20) throw new Error(`only ${frames.length} frames captured`);
    // ffconcat with each frame held until the next one arrived — but never
    // longer than 1.8s (the longest scripted pause), so waits on the network do not become dead air.
    const hold = (f, i) => Math.min(1.8, Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.04) - f.t));
    const list = frames.map((f, i) => `file '${f.file}'\nduration ${hold(f, i).toFixed(4)}`).join('\n');
    const concat = path.join(tmp, 'frames.txt');
    fs.writeFileSync(concat, `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
    const input = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat, '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`];
    run(FFMPEG, [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', path.join(OUT, 'flow.mp4')]);
    run(FFMPEG, [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-an', path.join(OUT, 'flow.webm')]);
    run('cwebp', ['-quiet', '-q', '82', '-resize', String(W), String(H), frames[0].file, '-o', path.join(OUT, 'flow-poster.webp')]);
    const secs = frames.reduce((n, f, i) => n + hold(f, i), 0).toFixed(1);
    console.log(`video flow.mp4/webm + poster  (${frames.length} frames, ${secs}s)`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await db.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hash]);
  await db.end();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('session revoked');
}
