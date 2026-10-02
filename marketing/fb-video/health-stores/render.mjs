import { chromium } from '/Users/sangnguyen/fangbot/_FANGBOT/_OPENCLAW-MAIN/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const D = new URL('.', import.meta.url).pathname, FPS = 30, DUR = 19;
const stills = process.argv.slice(2).map(Number);
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + D + 'health.html'); await p.waitForLoadState('load');
if (stills.length) {
  for (const t of stills) { await p.evaluate(t => renderAt(t), t); await p.screenshot({ path: `${D}still_${t}.png` }); }
} else {
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', FPS, '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', D + 'adlibraryspy-health-stores.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < DUR * FPS; f++) {
    await p.evaluate(t => renderAt(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await b.close();
