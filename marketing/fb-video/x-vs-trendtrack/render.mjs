// X ad: AdLibrarySpy vs TrendTrack (16:9, 20s). Frames from vs.html renderAt(t), music synthesized by ffmpeg.
import { chromium } from '/Users/sangnguyen/fangbot/_FANGBOT/_OPENCLAW-MAIN/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const D = new URL('.', import.meta.url).pathname, FPS = 30, DUR = 20, FF = process.env.FFMPEG || 'ffmpeg';
const stills = process.argv.slice(2).map(Number);
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + D + 'vs.html'); await p.waitForLoadState('load');
const run = (args) => new Promise((ok, no) => { const c = spawn(FF, args, { stdio: ['pipe', 'inherit', 'inherit'] }); c.on('close', x => x ? no(new Error('ffmpeg ' + x)) : ok()); return c; });
if (stills.length) {
  for (const t of stills) { await p.evaluate(t => renderAt(t), t); await p.screenshot({ path: `${D}still_${t}.png` }); }
} else {
  // 120 BPM: kick every 0.5s, hats on offbeats, A-minor bass, riser into 2.6s and 9.6s, sub hits on the reveals.
  const hit = (a) => `0.9*exp(-9*(t-${a}))*sin(2*PI*48*(t-${a}))*gte(t,${a})`;
  const rise = (a, b) => `0.18*between(t,${a},${b})*((t-${a})/(${b}-${a}))*sin(2*PI*(300+1400*((t-${a})/(${b}-${a})))*t)`;
  const expr = [
    `0.55*exp(-14*mod(t,0.5))*sin(2*PI*(55+90*exp(-30*mod(t,0.5)))*mod(t,0.5))*gte(t,2.6)*lt(t,19)`,
    `0.06*exp(-60*mod(t+0.25,0.5))*(random(0)*2-1)*gte(t,2.6)*lt(t,19)`,
    `0.16*sin(2*PI*if(lt(mod(t,4),2),55,if(lt(mod(t,4),3),43.65,49))*t)*gte(t,2.6)*lt(t,19.5)*(1-0.6*exp(-6*mod(t,0.5)))`,
    `0.05*sin(2*PI*440*t)*sin(2*PI*0.25*t)^2*lt(t,2.6)`,
    rise(0.4, 2.6), rise(8.0, 9.6), hit(2.6), hit(9.6), hit(12.2), hit(14.9), hit(16.4),
  ].join('+');
  await run(['-y', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=48000:d=${DUR}`, '-af', `afade=t=out:st=${DUR - 1.5}:d=1.5,alimiter=limit=0.9,loudnorm=I=-14:TP=-1`, '-ac', '2', '-ar', '48000', D + 'music.wav']);
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', FPS, '-i', '-', '-i', D + 'music.wav', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', D + 'adlibraryspy-vs-trendtrack.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < DUR * FPS; f++) {
    await p.evaluate(t => renderAt(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await b.close();
