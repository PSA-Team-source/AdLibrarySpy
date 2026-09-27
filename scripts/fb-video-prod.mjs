// Production capture session shared by the video-ad renderers
// (render-fb-video.mjs for the first ad, fb-video-v2.mjs for the angle set).
//
// Signs in as the dedicated screenshots account (SHOTS_EMAIL, default
// shots@marketlens.test) with a 30-minute session written straight to the DB
// and revoked at the end whatever happens — same as capture-landing.mjs. The
// helpers only ever keep element crops, so the account's name, email and
// workspace (all in the app chrome) never reach a frame.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const BASE = process.env.CAPTURE_BASE || 'https://adlibraryspy.com';
const EMAIL = process.env.SHOTS_EMAIL || 'shots@marketlens.test';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

function envFile() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}

/** Runs fn(helpers) inside a signed-in Chromium; crops land in helpers.dir (settable). */
export async function withProd({ chromium, dir }, fn) {
  const DATABASE_URL = process.env.DATABASE_URL || envFile().DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pg = (await import('pg')).default;
  const db = new pg.Client({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false } });
  await db.connect();
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = (await db.query('SELECT id FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!user) throw new Error(`no user ${EMAIL}`);
  await db.query(`INSERT INTO sessions (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, now() + interval '30 minutes', 'render-fb-video')`, [user.id, hash]);

  // Full Chromium, not the headless shell (the shell exited mid-capture before).
  const browser = await chromium.launch({ channel: 'chromium' });
  const h = { dir, BASE };
  try {
    // Tall viewports: the app scrolls inside its own container, so everything
    // that should be cropped has to be on screen at once.
    h.context = async (width, height, scale) => {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'reduce' });
      await ctx.addCookies([{ name: 'ml_session', value: token, url: BASE, httpOnly: true, secure: BASE.startsWith('https'), sameSite: 'Lax' }]);
      return ctx;
    };
    h.settle = async page => {
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
    h.shot = async (loc, name) => {
      await loc.scrollIntoViewIfNeeded();
      await loc.screenshot({ path: path.join(h.dir, `${name}.png`), animations: 'disabled' });
      console.log(`  ${name}.png`);
    };
    // Crop a column range of an element (x in CSS px relative to the element).
    h.clipShot = async (page, loc, name, fromLoc, toLoc, pad = 16) => {
      const b = await loc.boundingBox(), f = await fromLoc.boundingBox(), t = await toLoc.boundingBox();
      const x = Math.max(b.x, f.x - pad), x2 = Math.min(b.x + b.width, t.x + t.width + pad);
      const clip = { x, y: b.y, width: x2 - x, height: b.height };
      await page.screenshot({ path: path.join(h.dir, `${name}.png`), clip, animations: 'disabled' });
      console.log(`  ${name}.png`);
      return clip;
    };
    // Where a key number sits inside a crop, as fractions — the ad's highlight ring goes there.
    h.rectIn = async (clip, loc) => {
      // The painted text's box, not the (often full-width) cell's.
      const r = await loc.evaluate(el => { const g = document.createRange(); g.selectNodeContents(el); const b = g.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
      return { x: (r.x - clip.x) / clip.width, y: (r.y - clip.y) / clip.height, w: r.width / clip.width, h: r.height / clip.height };
    };
    h.boxOf = async loc => { await loc.scrollIntoViewIfNeeded(); return loc.boundingBox(); };
    h.text = async loc => (await loc.innerText()).trim();
    return await fn(h);
  } finally {
    await browser.close();
    await db.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hash]);
    await db.end();
    console.log('session revoked');
  }
}
