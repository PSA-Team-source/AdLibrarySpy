// Composer for scripts/render-fb-video.mjs: turns the captured production
// crops (marketing/fb-video/.work) into the 9:16 and 4:5 ads.
//
// The motion design is one HTML page per format whose renderAt(t) sets every
// transform from t alone (no CSS animations), so a frame is a pure function of
// time: Chromium screenshots each 1/30s and pipes it into ffmpeg. The music is
// synthesized by ffmpeg's aevalsrc (kick, clap, hats, bass, arpeggio, riser,
// impacts) — no samples and no third-party audio, so it is ours to run as an ad.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const LIME = '#a7f45a', INK = '#050807';
// Beat grid: 120 BPM, cuts on the half-beat. [start, end) seconds.
const T = { hook: [0, 2.5], ads: [2.5, 4], row: [4, 5.5], visits: [5.5, 7], liveads: [7, 8.5], products: [8.5, 10], tracker: [10, 12], end: [12, 18] };
const CUTS = [2.5, 4, 5.5, 7, 8.5, 10, 12];

const FORMATS = {
  // Reels/Stories: key text stays between 14% from the top and 35% from the bottom.
  '9x16': { W: 1080, H: 1920, capTop: 292, panelTop: 560, panelMaxH: 700, panelW: 960, hookY: 700, endY: 740, bugY: 1300, wallCols: 4 },
  // Feed 4:5: no overlay UI, so the story uses the whole frame.
  '4x5': { W: 1080, H: 1350, capTop: 70, panelTop: 330, panelMaxH: 850, panelW: 960, hookY: 640, endY: 675, bugY: 1215, wallCols: 4 },
};

const compact = n => n >= 1e6 ? `${(Math.floor(n / 1e5) / 10).toFixed(1)}M` : n >= 1e3 ? `${Math.floor(n / 1e3)}K` : String(n);

function page(fmt, data, ads) {
  const F = FORMATS[fmt];
  const R = data.rings;
  const cfg = { F, T, R, ads, fmt };
  const liveAds = data.liveAds.toLocaleString('en-US');
  const target = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const scenes = [
    ['ads', 'Ads library', 'Browse real <b>Facebook ads</b>'],
    ['row', 'Shop search', 'Find the store <b>behind the ads</b>'],
    ['visits', `Traffic · ${data.visitsSource?.split('·')[0].trim() || 'measured'}`, `<b>${data.visits}</b> visits a month`],
    ['liveads', 'Live Meta ads', 'Their ad count, <b>every day</b>'],
    ['products', 'Products', data.bestSellers ? 'Their <b>best\u00a0sellers</b>, ranked' : 'Every <b>product</b> they sell'],
    ['tracker', 'Brandtracker', 'Track <b>every competitor</b>'],
  ];
  // One span per word (each word animates in); <b>…</b> words are lime.
  const caption = ([id, kicker, head]) => {
    let lime = false;
    const words = head.split(' ').map(tok => {
      if (tok.startsWith('<b>')) lime = true;
      const span = `<span class="w${lime ? ' lime' : ''}">${tok.replace(/<\/?b>/g, '')}</span>`;
      if (tok.includes('</b>')) lime = false;
      return span;
    });
    return `<div class="cap" id="cap-${id}"><div class="kick">${kicker}</div><div class="head">${words.join(' ')}</div></div>`;
  };
  const stores = data.shopsIndexed ? `${compact(data.shopsIndexed)} stores indexed` : null;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${F.W}px;height:${F.H}px;overflow:hidden;background:${INK};font-family:Inter,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
#stage{position:absolute;inset:0;overflow:hidden}
.glow{position:absolute;left:50%;width:1400px;height:1400px;margin-left:-700px;border-radius:50%;background:radial-gradient(closest-side,${LIME}40,transparent);filter:blur(40px)}
#wall{position:absolute;left:50%;top:50%;width:1500px;height:2600px;margin:-1300px 0 0 -750px;display:flex;gap:26px;justify-content:center}
#wall .col{width:330px;display:flex;flex-direction:column;gap:26px;will-change:transform}
#wall img{width:330px;border-radius:22px;display:block;box-shadow:0 20px 50px rgba(0,0,0,.45)}
#shade{position:absolute;inset:0}
.cap{position:absolute;left:60px;right:60px;top:${F.capTop}px;text-align:center}
.kick{display:inline-block;font-size:30px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${INK};background:${LIME};padding:9px 20px 8px;border-radius:999px}
.head{margin-top:22px;font-size:82px;line-height:1.02;font-weight:900;letter-spacing:-.035em;text-wrap:balance}
.w{display:inline-block}
.lime{color:${LIME}}
.panel{position:absolute;left:50%;overflow:hidden;border-radius:34px;background:#f5f6fa;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 50px 120px -30px ${LIME}66,0 30px 80px rgba(0,0,0,.6)}
.sheet{position:absolute;left:0;top:0;transform-origin:0 0;background:#f5f6fa}
.sheet img{display:block}
.ring{position:absolute;border:7px solid ${LIME};border-radius:20px;box-shadow:0 0 0 4px ${INK}33,0 0 40px ${LIME}}
#hook{position:absolute;left:0;right:0;text-align:center}
#hook .l1,#hook .l3,.head{text-shadow:0 4px 28px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.6)}
#hook .l1{font-size:62px;font-weight:800;letter-spacing:-.03em}
#hook .num{font-size:${fmt === '9x16' ? 300 : 270}px;line-height:.95;font-weight:900;letter-spacing:-.06em;color:${LIME};text-shadow:0 0 80px ${LIME}88;margin:6px 0 64px}
#hook .l3{font-size:74px;font-weight:900;letter-spacing:-.035em;line-height:1.05}
#hook .chip{display:inline-flex;align-items:center;gap:14px;margin-top:36px;font-size:40px;font-weight:700;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.25);backdrop-filter:blur(8px)}
#hook .chip i{width:16px;height:16px;border-radius:50%;background:#22c55e;box-shadow:0 0 16px #22c55e}
.bug{position:absolute;left:0;right:0;top:${F.bugY}px;display:flex;justify-content:center;align-items:center;gap:14px;font-size:34px;font-weight:700;letter-spacing:-.02em;color:rgba(255,255,255,.85)}
.mark{display:grid;place-items:center;background:${LIME};color:#071004}
.mark svg{width:63%;height:63%}
.bug .mark{width:44px;height:44px;border-radius:13px}
#end{position:absolute;left:0;right:0;text-align:center}
#end .lock{display:inline-flex;align-items:center;gap:22px;font-size:58px;font-weight:800;letter-spacing:-.03em}
#end .lock .mark{width:92px;height:92px;border-radius:28px}
#end .h{margin-top:46px;font-size:${fmt === '9x16' ? 96 : 90}px;line-height:1;font-weight:900;letter-spacing:-.04em}
#end .ticks{margin:44px auto 0;display:flex;flex-direction:column;align-items:center;gap:18px}
#end .tick{display:inline-flex;align-items:center;gap:16px;font-size:46px;font-weight:700}
#end .tick span{width:50px;height:50px;border-radius:50%;background:${LIME}22;border:2px solid ${LIME}88;color:${LIME};display:grid;place-items:center}
#end .tick svg{width:28px;height:28px}
#end .cta{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:18px;margin-top:52px;height:132px;padding:0 64px;border-radius:30px;background:${LIME};color:#071004;font-size:58px;font-weight:900;letter-spacing:-.03em;box-shadow:0 0 90px -10px ${LIME}}
#end .cta svg{width:52px;height:52px}
#end .sheen{position:absolute;top:0;bottom:0;width:160px;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent)}
#end .url{margin-top:26px;font-size:40px;font-weight:600;color:rgba(255,255,255,.8)}
</style></head><body><div id="stage">
<div class="glow" id="glow"></div>
<div id="wall"></div>
<div id="shade"></div>
<div id="hook"><div class="l1">This Shopify store is running</div><div class="num">${liveAds}</div><div class="l3">Facebook ads<br>right now</div><div class="chip"><i></i>${data.store}</div></div>
${scenes.map(caption).join('\n')}
<div class="panel" id="panel-row"><div class="sheet"><img src="shop_head.png" id="img-shophead"><img src="shop_row.png" id="img-row"></div></div>
<div class="panel" id="panel-visits"><div class="sheet" style="width:1290px;padding-bottom:48px"><img src="dossier_head.png"><img src="visits.png" id="img-visits" style="margin:0 48px"></div></div>
<div class="panel" id="panel-liveads"><div class="sheet"><img src="liveads.png" id="img-liveads"></div></div>
<div class="panel" id="panel-products"><div class="sheet"><img src="products.png" id="img-products"></div></div>
<div class="panel" id="panel-tracker"><div class="sheet"><img src="brandtracker.png" id="img-tracker"></div></div>
<div class="bug" id="bug"><span class="mark">${target}</span>adlibraryspy.com</div>
<div id="end">
  <div class="lock"><span class="mark">${target}</span>AdLibrarySpy</div>
  <div class="h">The <span class="lime">free</span><br>TrendTrack<br>alternative</div>
  <div class="ticks"><div class="tick"><span>${check}</span>Free forever</div><div class="tick"><span>${check}</span>No credit card</div>${stores ? `<div class="tick"><span>${check}</span>${stores}</div>` : ''}</div>
  <div class="cta"><div class="sheen"></div>Sign up free<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
  <div class="url">adlibraryspy.com</div>
</div>
</div>
<script>
const C = ${JSON.stringify(cfg)};
const F = C.F, T = C.T, R = C.R;
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const eOut = k => 1 - Math.pow(1 - clamp(k), 3);
const eInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eBack = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const prog = (t, a, d) => clamp((t - a) / d);

// ---- ad wall: 4 columns of live creatives, endlessly scrolling at different speeds
const wall = $('#wall');
const cols = [];
for (let c = 0; c < F.wallCols; c++) {
  const col = document.createElement('div'); col.className = 'col';
  const list = C.ads.map((_, i) => C.ads[(i + c * 3) % C.ads.length]);
  for (const src of [...list, ...list]) { const im = document.createElement('img'); im.src = src; col.appendChild(im); }
  wall.appendChild(col); cols.push(col);
}

// ---- scene panels: a sheet of real crops seen through a moving camera
const P = {
  row:      { cam: [{ cx: .1, cy: .5, z: 2.7 }, { cx: .85, cy: .5, z: 2.7 }], hFromZ: true, rings: [['img-row', R.shopTraffic, .35], ['img-row', R.shopAds, .85]] },
  visits:   { cam: [{ cx: .5, cy: 0, z: 1 }, { ring: 0, z: 2.1 }], rings: [['img-visits', R.visits, .55]] },
  liveads:  { cam: [{ ring: 0, z: 2.1 }, { cx: .5, cy: .5, z: 1.02 }], rings: [['img-liveads', R.liveads, .05]] },
  products: { cam: [{ cx: .5, cy: 0, z: 1.06 }, { cx: .5, cy: .38, z: 1.06 }], rings: [] },
  tracker:  { cam: [{ cx: 0, cy: .3, z: 2.3 }, { ring: 0, z: 1.9 }], hFromZ: true, rings: [['img-tracker', R.tracker, .5]] },
};
function setup() {
  for (const [id, s] of Object.entries(P)) {
    s.el = $('#panel-' + id); s.sheet = s.el.querySelector('.sheet');
    const imgs = [...s.sheet.querySelectorAll('img')];
    const w = Math.max(...imgs.map(im => im.naturalWidth));
    if (!s.sheet.style.width) s.sheet.style.width = w + 'px';
    for (const im of imgs) im.style.width = (im.style.margin ? (parseFloat(s.sheet.style.width) - 96) : parseFloat(s.sheet.style.width)) + 'px';
    s.sw = s.sheet.offsetWidth; s.sh = s.sheet.offsetHeight;
    s.fit = F.panelW / s.sw;
    s.pw = F.panelW;
    s.ph = s.hFromZ ? Math.min(F.panelMaxH, Math.round(s.sh * s.fit * s.cam[0].z)) : Math.min(F.panelMaxH, Math.round(s.sh * s.fit));
    s.el.style.width = s.pw + 'px'; s.el.style.height = s.ph + 'px'; s.el.style.marginLeft = -s.pw / 2 + 'px';
    s.el.style.top = (F.panelTop + (F.panelMaxH - s.ph) / 2 * (s.hFromZ ? .75 : 1)) + 'px';
    s.ringEls = s.rings.map(([imgId, r, at]) => {
      const im = document.getElementById(imgId);
      const pad = 18, box = { x: im.offsetLeft + r.x * im.offsetWidth - pad, y: im.offsetTop + r.y * im.offsetHeight - pad, w: r.w * im.offsetWidth + pad * 2, h: r.h * im.offsetHeight + pad * 2 };
      const el = document.createElement('div'); el.className = 'ring';
      Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', borderWidth: (7 / s.fit / (s.cam[1].z || 1)) + 'px', borderRadius: (18 / s.fit) + 'px' });
      s.sheet.appendChild(el);
      return { el, box, at };
    });
  }
}
function camPoint(s, c) {
  if (c.ring == null) return { cx: c.cx, cy: c.cy, z: c.z };
  const b = s.ringEls[c.ring].box;
  return { cx: (b.x + b.w / 2) / s.sw, cy: (b.y + b.h / 2) / s.sh, z: c.z };
}
function place(s, k) {
  const a = camPoint(s, s.cam[0]), b = camPoint(s, s.cam[1]), e = eInOut(k);
  const z = lerp(a.z, b.z, e), sc = s.fit * z;
  const cx = lerp(a.cx, b.cx, e) * s.sw * sc, cy = lerp(a.cy, b.cy, e) * s.sh * sc;
  const W = s.sw * sc, H = s.sh * sc;
  let x = s.pw / 2 - cx, y = s.ph / 2 - cy;
  x = W <= s.pw ? (s.pw - W) / 2 : clamp(x, s.pw - W, 0);
  y = H <= s.ph ? (s.ph - H) / 2 : clamp(y, s.ph - H, 0);
  s.sheet.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
}
function enterExit(el, t, [a, b], { dy = 70, s0 = .92 } = {}) {
  const i = eBack(prog(t, a, .32)), o = eOut(prog(t, b - .16, .16));
  const on = t >= a && t < b;
  el.style.visibility = on ? 'visible' : 'hidden';
  el.style.opacity = on ? Math.min(prog(t, a, .12), 1 - o) : 0;
  el.style.transform = 'translateY(' + (dy * (1 - i) - 60 * o) + 'px) scale(' + (s0 + (1 - s0) * i) + ')';
}
function captionAt(id, t, [a, b]) {
  const cap = document.getElementById('cap-' + id), on = t >= a && t < b;
  cap.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const o = eOut(prog(t, b - .16, .16));
  cap.style.opacity = 1 - o;
  cap.style.transform = 'translateY(' + (-40 * o) + 'px)';
  const k = cap.querySelector('.kick'), ki = eBack(prog(t, a, .25));
  k.style.transform = 'scale(' + (.6 + .4 * ki) + ')'; k.style.opacity = prog(t, a, .08);
  cap.querySelectorAll('.w').forEach((w, i) => {
    const p = eBack(prog(t, a + .05 + i * .045, .28));
    w.style.opacity = prog(t, a + .05 + i * .045, .1);
    w.style.transform = 'translateY(' + (50 * (1 - p)) + 'px)';
  });
}

window.renderAt = t => {
  // background + wall
  const glow = $('#glow');
  glow.style.top = (F.H * (t < T.end[0] ? .12 : .18) - 700) + 'px';
  glow.style.opacity = t < T.end[0] ? .55 : .9;
  const inHook = t < T.hook[1], inAds = t >= T.ads[0] && t < T.ads[1], inEnd = t >= T.end[0];
  const toAds = eInOut(prog(t, T.hook[1] - .35, .5));
  const rot = inAds ? lerp(-9, -5, prog(t, T.ads[0], 1.5)) : -9;
  const scl = inHook || inAds ? lerp(1.15, 1.02, toAds) + (inAds ? .08 * prog(t, T.ads[0], 1.5) : 0) : 1.15;
  wall.style.transform = 'rotate(' + rot + 'deg) scale(' + scl + ')';
  cols.forEach((col, c) => {
    const half = col.scrollHeight / 2, speed = (c % 2 ? 150 : 110) * (inAds ? 1.6 : 1);
    col.style.transform = 'translateY(' + (-((t * speed + c * 380) % half)) + 'px)';
  });
  // The wall is the hero of the hook and of the ads scene; behind the rest it is a faint texture.
  const wallOp = inHook ? 1 : inAds ? 1 : inEnd ? .22 * eOut(prog(t, T.end[0], .6)) : .16;
  wall.style.opacity = wallOp;
  const dim = inHook ? .78 : inAds ? lerp(.72, .38, eOut(prog(t, T.ads[0], .5))) : .55;
  $('#shade').style.background = 'linear-gradient(180deg,' + ${JSON.stringify(INK)} + 'f2 0%,' + ${JSON.stringify(INK)} + Math.round(dim * 255).toString(16).padStart(2, '0') + ' ' + (F.capTop + 330) / F.H * 100 + '%,' + ${JSON.stringify(INK)} + Math.round(dim * 255).toString(16).padStart(2, '0') + ' 70%,' + ${JSON.stringify(INK)} + 'f5 100%)';

  // hook — text is on screen from frame 0 (sound-off feeds), with a punch-in
  const hook = $('#hook');
  hook.style.visibility = inHook ? 'visible' : 'hidden';
  if (inHook) {
    hook.style.top = (F.hookY - hook.offsetHeight / 2) + 'px';
    const out = eInOut(prog(t, T.hook[1] - .3, .3));
    hook.style.opacity = 1 - out;
    hook.style.transform = 'translateY(' + (-120 * out) + 'px) scale(' + (1 + .06 * out) + ')';
    const num = hook.querySelector('.num'), p = eBack(prog(t, 0, .45));
    num.style.transform = 'scale(' + (1.12 - .12 * p) + ') rotate(' + (-4 * (1 - p)) + 'deg)';
    const l1 = hook.querySelector('.l1'); l1.style.transform = 'scale(' + (1.08 - .08 * eOut(prog(t, 0, .4))) + ')';
    const l3 = hook.querySelector('.l3'), q = eBack(prog(t, .12, .4));
    l3.style.transform = 'translateY(' + (40 * (1 - q)) + 'px)';
    const chip = hook.querySelector('.chip'), c = eBack(prog(t, .95, .35));
    chip.style.opacity = prog(t, .95, .1); chip.style.transform = 'scale(' + (.5 + .5 * c) + ')';
  }

  for (const id of ['ads', 'row', 'visits', 'liveads', 'products', 'tracker']) captionAt(id, t, T[id]);
  for (const [id, s] of Object.entries(P)) {
    const [a, b] = T[id];
    enterExit(s.el, t, [a, b]);
    if (t >= a && t < b) place(s, prog(t, a + .1, b - a - .25));
    s.ringEls.forEach(r => {
      const k = eBack(prog(t, a + r.at, .3));
      r.el.style.opacity = prog(t, a + r.at, .08);
      r.el.style.transform = 'scale(' + (1.35 - .35 * k) + ')';
    });
  }
  const bug = $('#bug'), bugOn = t >= T.row[0] && t < T.end[0];
  bug.style.opacity = bugOn ? .9 * prog(t, T.row[0], .3) : 0;

  // end card
  const end = $('#end');
  end.style.visibility = inEnd ? 'visible' : 'hidden';
  if (inEnd) {
    end.style.top = (F.endY - end.offsetHeight / 2) + 'px';
    const a = T.end[0];
    const pop = (sel, at, dy = 60) => { const el = end.querySelector(sel), k = eBack(prog(t, a + at, .35)); el.style.opacity = prog(t, a + at, .1); el.style.transform = 'translateY(' + dy * (1 - k) + 'px) scale(' + (.85 + .15 * k) + ')'; };
    pop('.lock', 0); pop('.h', .18, 80);
    end.querySelectorAll('.tick').forEach((el, i) => { const k = eBack(prog(t, a + .55 + i * .15, .3)); el.style.opacity = prog(t, a + .55 + i * .15, .1); el.style.transform = 'translateX(' + (-80 * (1 - k)) + 'px)'; });
    pop('.cta', 1.05, 90);
    const cta = end.querySelector('.cta');
    if (t > a + 1.5) cta.style.transform = 'scale(' + (1 + .035 * Math.max(0, Math.sin((t - a - 1.5) * Math.PI * 2 / 1))) + ')';
    const sheen = end.querySelector('.sheen'), sp = ((t - a - 1.6) % 1.6) / .7;
    sheen.style.left = (t > a + 1.6 && sp <= 1 ? lerp(-200, cta.offsetWidth + 40, sp) : -400) + 'px';
    pop('.url', 1.25, 30);
  }
};
window.ready = (async () => { await document.fonts.ready; await Promise.all([...document.images].map(im => im.decode().catch(() => {}))); setup(); return document.fonts.check('900 80px Inter'); })();
</script></body></html>`;
}

// ------------------------------------------------------------------ music ---
// 120 BPM in A minor (Am F C G), 18s: four-on-the-floor kick, clap on 2 and 4,
// open hats on the off-beats, a pumping bass, a 16th-note arpeggio, whooshes on
// every cut, a riser into the end card, and sub impacts on the hook and the CTA.
function music(FFMPEG, file) {
  const cut = CUTS.map(c => `0.5*exp(-pow((t-${c}+0.06)/0.07,2))`).join('+');
  const chord = 'floor(mod(t,8)/2)';
  const root = `if(eq(${chord},0),55,if(eq(${chord},1),43.65,if(eq(${chord},2),65.41,49)))`;
  const k = 'mod(floor(t/0.125),4)';
  const arpTab = [[440, 523.25, 659.25, 880], [349.23, 440, 523.25, 698.46], [523.25, 659.25, 783.99, 1046.5], [392, 493.88, 587.33, 783.99]];
  const sel = (arr, idx) => arr.slice(0, -1).reduceRight((acc, v, i) => `if(eq(${idx},${i}),${v},${acc})`, String(arr.at(-1)));
  const arp = `if(eq(${chord},0),${sel(arpTab[0], k)},if(eq(${chord},1),${sel(arpTab[1], k)},if(eq(${chord},2),${sel(arpTab[2], k)},${sel(arpTab[3], k)})))`;
  const drums = 'not(between(t,11.5,11.999))*lt(t,17.5)';
  const kick = `${drums}*0.9*sin(2*PI*(45*mod(t,0.5)+3.2*(1-exp(-30*mod(t,0.5)))))*exp(-7*mod(t,0.5))`;
  const bass = `lt(t,17.5)*not(between(t,11.5,11.999))*gte(mod(t,0.5),0.25)*0.32*(sin(2*PI*${root}*2*mod(t,0.25))+0.5*sin(2*PI*${root}*4*mod(t,0.25))+0.25*sin(2*PI*${root}*6*mod(t,0.25)))*exp(-6*mod(t,0.25))*(1-exp(-200*mod(t,0.25)))`;
  const arpV = `lt(t,17.6)*0.13*(sin(2*PI*${arp}*mod(t,0.125))+0.3*sin(4*PI*${arp}*mod(t,0.125)))*exp(-16*mod(t,0.125))*(1-exp(-400*mod(t,0.125)))`;
  const sub = at => `gte(t,${at})*0.8*sin(2*PI*(38*(t-${at})+7.5*(1-exp(-8*(t-${at})))))*exp(-2.2*(t-${at}))`;
  const riser = `between(t,10.4,12)*0.07*((t-10.4)/1.6)*sin(2*PI*(260*(t-10.4)+180*pow(t-10.4,2)))`;
  const tonal = [kick, bass, arpV, sub(0), sub(12), riser].join('+');
  const clap = `${drums}*(2*random(0)-1)*(0.4*exp(-24*mod(t-0.5,1))*gte(mod(t,1),0.5) + ${cut} + between(t,10.4,12)*0.35*pow((t-10.4)/1.6,2))`;
  const hat = `lt(t,17.5)*(2*random(0)-1)*(0.16*exp(-45*mod(t-0.25,0.5))*gte(mod(t,0.5),0.25) + 0.4*gte(t,12)*exp(-3*(t-12)) + 0.4*exp(-3*t))`;
  const graph = [
    `aevalsrc=exprs='${tonal}':s=48000:d=18[a]`,
    `aevalsrc=exprs='${clap}':s=48000:d=18,highpass=f=900,lowpass=f=9000[b]`,
    `aevalsrc=exprs='${hat}':s=48000:d=18,highpass=f=7000[c]`,
    `[a][b][c]amix=inputs=3:normalize=0,aformat=channel_layouts=stereo,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=16.8:d=1.2,aresample=48000[m]`,
  ].join(';');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-filter_complex', graph, '-map', '[m]', '-t', '18', '-c:a', 'pcm_s16le', file], { stdio: ['ignore', 'ignore', 'inherit'] });
}

// ----------------------------------------------------------------- render ---
export async function render({ WORK, OUT, FFMPEG, FPS, DUR, chromium }) {
  const data = JSON.parse(fs.readFileSync(path.join(WORK, 'data.json'), 'utf8'));
  const ads = fs.readdirSync(WORK).filter(f => /^ad_\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3)));
  const wav = path.join(WORK, 'music.wav');
  music(FFMPEG, wav);
  console.log('music.wav');
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    for (const fmt of Object.keys(FORMATS)) {
      const { W, H } = FORMATS[fmt];
      const html = path.join(WORK, `compose_${fmt}.html`);
      fs.writeFileSync(html, page(fmt, data, ads));
      const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await pg.goto('file://' + html);
      if (!(await pg.evaluate(() => window.ready))) throw new Error('Inter did not load — refusing to render with a fallback font');
      const mp4 = path.join(OUT, `als_video_${fmt}.mp4`);
      const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '11M', '-bufsize', '22M', '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-level', '4.2', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(DUR), '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error(`ffmpeg exited ${c}`)) : res()));
      const total = FPS * DUR;
      for (let i = 0; i < total; i++) {
        await pg.evaluate(t => window.renderAt(t), i / FPS);
        const buf = await pg.screenshot({ type: 'jpeg', quality: 95 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (i % 90 === 0) process.stdout.write(`\r${fmt} ${i}/${total}`);
      }
      ff.stdin.end();
      await done;
      // Thumbnail: the hook with every line landed (the store chip included).
      await pg.evaluate(t => window.renderAt(t), 1.6);
      await pg.screenshot({ type: 'jpeg', quality: 90, path: path.join(OUT, `thumb_${fmt}.jpg`) });
      const mb = (fs.statSync(mp4).size / 1048576).toFixed(1);
      console.log(`\r${path.basename(mp4)}  ${W}x${H}  ${DUR}s  ${mb} MB`);
      if (mb > 30) throw new Error(`${mp4} is ${mb} MB (> 30 MB)`);
      await pg.close();
    }
  } finally {
    await browser.close();
  }
}
