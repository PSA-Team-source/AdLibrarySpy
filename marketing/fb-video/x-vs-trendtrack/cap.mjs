import { chromium } from '/Users/sangnguyen/fangbot/_FANGBOT/_OPENCLAW-MAIN/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'chromium' });
const pages = { store: '/store/resilia.shop', stores: '/stores', health: '/stores/niche/health', home: '/', trending: '/stores/trending', vs: '/vs/trendtrack' };
for (const scheme of ['light', 'dark']) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce' });
  for (const [k, u] of Object.entries(pages)) {
    const p = await c.newPage();
    await p.goto('https://adlibraryspy.com' + u, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('[id*=cookie],[class*=cookie]').forEach(e => e.remove()));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `scr/${k}-${scheme}.jpg`, quality: 90 });
    await p.close();
  }
}
await b.close();
