// Composer for scripts/render-fb-images.mjs: turns the captured production crops and
// numbers (marketing/fb-images/.work/data.json) into the 20 static signup ads, in 4:5
// and 9:16, plus manifest.json and the two QA contact sheets.
//
// Each concept is an HTML/CSS page screenshotted by Chromium. The content block is
// auto-fitted into the format's safe box (9:16 keeps 14% top / 35% bottom clear), and
// the render reports the fit scale so an illegible squeeze shows up in the log.
// Every number is read from data.json; a missing one throws.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const LIME = '#a7f45a', INK = '#050807';
const FORMATS = {
  '4x5': { W: 1080, H: 1350, top: 64, bottom: 64, side: 64, suffix: '' },
  // Stories/Reels: key content between 14% (269px) from the top and 35% (672px) from the bottom.
  '9x16': { W: 1080, H: 1920, top: 289, bottom: 692, side: 60, suffix: '_9x16' },
};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const need = (v, what) => { if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) throw new Error(`render: ${what} missing`); return v; };
const n0 = n => Number(n).toLocaleString('en-US');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const CROSS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

const lockup = (cls = '') => `<div class="lock ${cls}"><span class="mark">${TARGET}</span>AdLibrarySpy</div>`;
// Footer: lockup left, CTA pill right with the "free" line under it.
const foot = (cls = '', style = '') => `<div class="foot ${cls}" style="${style}"><div class="lock"><span class="mark">${TARGET}</span>AdLibrarySpy</div><div class="fc"><div class="cta">Sign up free${ARROW}</div><div class="fine">Free forever · No credit card</div></div></div>`;
const cta = (cls = '', label = 'Sign up free') => `<div class="ctarow ${cls}"><div class="cta">${label}${ARROW}</div><div class="fine">Free forever · No credit card</div></div>`;

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
#bg{position:absolute;inset:0;overflow:hidden}
#safe{position:absolute;display:flex;align-items:center;justify-content:center}
#fit{width:100%}
img{display:block}
.lock{display:inline-flex;align-items:center;gap:16px;font-weight:700;font-size:38px;letter-spacing:-.02em}
.lock .mark{width:56px;height:56px;border-radius:17px;background:${LIME};color:#071004;display:grid;place-items:center}
.lock .mark svg{width:35px;height:35px}
.ctarow{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.cta{display:inline-flex;align-items:center;gap:14px;background:${LIME};color:#071004;font-weight:800;font-size:40px;letter-spacing:-.01em;padding:24px 40px;border-radius:999px;box-shadow:0 10px 40px rgba(167,244,90,.35)}
.cta svg{width:36px;height:36px}
.fine{font-size:28px;font-weight:600;opacity:.75}
.foot{display:flex;justify-content:space-between;align-items:center;gap:24px}.foot .fc{display:flex;flex-direction:column;align-items:flex-end;gap:14px}.foot .fine{font-size:24px}
.light .foot .cta,.foot.light .cta{background:${INK};color:${LIME};box-shadow:0 10px 30px rgba(5,8,7,.25)}.foot.lime .cta{background:${INK};color:${LIME};box-shadow:none}
.dark{color:#fff}.light{color:${INK}}
.light .cta{background:${INK};color:${LIME};box-shadow:0 10px 30px rgba(5,8,7,.25)}
.lime .cta{background:${INK};color:${LIME};box-shadow:none}
.kick{font-size:30px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.shot{border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.shot img{width:100%}
.hl{color:${LIME}}
.row{display:flex;align-items:center}
.src{font-size:22px;font-weight:500;opacity:.6}
`;

// ------------------------------------------------------------------ concepts ---
function concepts(D, img) {
  const S = D.stores;
  const C = [];
  const add = c => C.push(c);
  const week = D.weekly.week.split(':')[0];

  // i01 — big-number hook on one store's live ad count.
  {
    const s = S['mellowsleep.com'];
    add({
      id: 'i01', concept: 'Big-number hook: one store\'s live Meta ad count, with its live-ads chart', store: s.domain, theme: 'dark',
      page: `/shops (dossier ${s.href})`,
      bg: () => `<div style="position:absolute;inset:0;background:radial-gradient(900px 700px at 50% 38%,#16310c 0%,${INK} 70%)"></div>`,
      body: `
        <div class="kick" style="color:${LIME};opacity:.9">${esc(s.domain)} · right now</div>
        <div style="font-size:250px;font-weight:900;letter-spacing:-.05em;line-height:1;margin:22px 0 26px;color:${LIME}">${n0(s.liveAds)}</div>
        <div style="font-size:66px;font-weight:800;letter-spacing:-.03em;line-height:1.05">Facebook ads running.<br><span style="opacity:.6">One Shopify store.</span></div>
        <div class="shot" style="margin:46px 0 44px;transform:rotate(-1.2deg);border:4px solid rgba(167,244,90,.5)"><img src="${img(s.adsCard)}"></div>
        ${foot('', "gap:24px")}`,
      numbers: [{ value: n0(s.liveAds), source_page: s.href }],
      headline: 'See every ad a store is running',
      description: 'Live Meta ads for any store. Free, no card.',
      primary: `${s.name} has ${n0(s.liveAds)} Facebook ads live right now. I looked it up on AdLibrarySpy, the free ad spy tool I built for ecom sellers. Type any store and see its live Meta ads, traffic and products. Free, no credit card.`,
    });
  }

  // i02 — product UI hero: the Shops table with callouts on the columns.
  {
    const cols = need(D.shopsCols, 'shops column positions');
    const at = l => need(cols.find(c => c.label.startsWith(l)), `column ${l}`);
    const call = (c, label, i) => `<div class="call" style="left:${(c.x * 100).toFixed(1)}%;top:${-120 + (i % 2) * 0}px">${label}<i></i></div>`;
    const r0 = D.shopsRows[0];
    add({
      id: 'i02', concept: 'Product UI hero: live Shops table with callouts on traffic, growth and ad columns', store: 'Shops table (top stores by live ads)', theme: 'light',
      page: '/shops',
      css: `.tbl{position:relative;margin-top:150px}.call{position:absolute;transform:translateX(-50%);background:${INK};color:${LIME};font-weight:800;font-size:30px;padding:14px 22px;border-radius:16px;white-space:nowrap}
        .call i{position:absolute;left:50%;bottom:-14px;width:28px;height:28px;background:${INK};transform:translateX(-50%) rotate(45deg);border-radius:4px;z-index:-1}`,
      bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#eef5e6,#f7f8f5)"></div>`,
      body: `
        ${lockup()}
        <div style="font-size:84px;font-weight:900;letter-spacing:-.04em;line-height:1;margin-top:40px">Every store's traffic<br>and live ads. <span style="background:${LIME};padding:0 12px;border-radius:14px">Free.</span></div>
        <div class="tbl"><div class="shot" style="box-shadow:0 30px 70px rgba(5,8,7,.18);border:2px solid #dfe5d8"><img src="${img(D.shopsTable)}"></div>
          ${call(at('Monthly Traffic'), 'Monthly visits', 0)}${call(at('Growth'), 'Growth', 1)}${call(at('Ads'), 'Live ads', 2)}</div>
        <div style="margin-top:46px">${cta('light')}</div>`,
      numbers: [{ value: n0(D.shopsIndexed), source_page: '/shops' }, ...D.shopsRows.map(r => ({ value: `${r[0][0]}: ${r[1][0]} visits, ${r[2][0]}, ${r[3][0]} ads`, source_page: '/shops' }))],
      headline: 'Every store\'s traffic and ads, free',
      description: `${(D.shopsIndexed / 1e6).toFixed(1)}M stores. No card needed.`,
      primary: `This is the Shops table in AdLibrarySpy. Each row is a real store: its monthly visits (SimilarWeb), growth and how many Facebook ads it runs today. Right now ${r0[0][0]} is at the top with ${r0[3][0]} ads. Sort by what matters to you and open any store. It's free, no card.`,
    });
  }

  // i03 — price comparison, only claims printed on /vs/trendtrack.
  {
    const v = D.vs;
    const lo = v.tiers[0].usd, hi = v.tiers[2].usd;
    const brands = v.theirBrands.match(/(\d+) brands on Starter.*?(\d+) on Business/);
    need(brands, 'TrendTrack brand caps');
    const line = (l, a, b) => `<div class="cmp"><div class="lab">${l}</div><div class="them">${a}</div><div class="us">${b}</div></div>`;
    add({
      id: 'i03', concept: 'Price comparison: TrendTrack plans vs AdLibrarySpy $0, claims from /vs/trendtrack', store: 'TrendTrack comparison', theme: 'light',
      page: '/vs/trendtrack',
      css: `.cmp{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;border-top:2px solid rgba(5,8,7,.1);padding:26px 0;font-size:34px;font-weight:700}
        .cmp .lab{font-size:28px;font-weight:600;opacity:.6}.cmp .them{color:#6b716c;text-decoration:line-through;text-decoration-thickness:3px}.cmp .us{color:${INK}}
        .price{border-radius:32px;padding:36px 36px;flex:1}`,
      bg: () => `<div style="position:absolute;inset:0;background:#f5f6f2"></div><div style="position:absolute;right:-200px;top:-200px;width:700px;height:700px;border-radius:50%;background:${LIME};opacity:.35;filter:blur(40px)"></div>`,
      body: `
        ${lockup()}
        <div style="font-size:80px;font-weight:900;letter-spacing:-.04em;line-height:1.02;margin:36px 0 40px">Meta ad research.<br>No monthly bill.</div>
        <div class="row" style="gap:24px;align-items:stretch">
          <div class="price" style="background:#e4e7e1"><div style="font-size:30px;font-weight:700;opacity:.6">TrendTrack</div>
            <div style="font-size:74px;font-weight:900;letter-spacing:-.04em;color:#5b615c;margin-top:8px;white-space:nowrap">$${lo}–$${hi}</div><div style="font-size:30px;font-weight:600;opacity:.6">per month</div></div>
          <div class="price" style="background:${INK};color:#fff"><div style="font-size:30px;font-weight:700;color:${LIME}">AdLibrarySpy</div>
            <div style="font-size:92px;font-weight:900;letter-spacing:-.04em;color:${LIME};margin-top:8px">$0</div><div style="font-size:30px;font-weight:600;opacity:.8">no card, no credits</div></div>
        </div>
        <div style="margin-top:34px">
          ${line('Tracked brands', `${brands[1]}–${brands[2]}`, 'No cap')}
          ${line('Extra teammates', `$${v.seatPrice}/seat`, 'Free')}
        </div>
        <div style="margin-top:30px">${cta('light')}</div>
        <div class="src" style="margin-top:22px">TrendTrack prices from its public pricing page, checked ${esc(v.checked)}. TrendTrack is a trademark of its owner; not affiliated.</div>`,
      numbers: [{ value: `$${lo}–$${hi}/month (TrendTrack Starter–Business)`, source_page: '/vs/trendtrack' }, { value: `${brands[1]}–${brands[2]} tracked brands`, source_page: '/vs/trendtrack' }, { value: `$${v.seatPrice} per extra seat`, source_page: '/vs/trendtrack' }, { value: '$0', source_page: '/vs/trendtrack' }],
      headline: `$${hi}/month vs $0`,
      description: 'A free TrendTrack alternative. No card.',
      primary: `TrendTrack costs $${lo} to $${hi} a month. AdLibrarySpy is free: live Meta ads, store traffic, products and a brandtracker with no brand cap, and your team joins free. TrendTrack still does things we don't (Google and TikTok ads), and our comparison page says so. If Meta ads are what you need, try it free.`,
    });
  }

  // i04 — this week's top 5 scaling stores (the Monday report).
  {
    const top = D.weekly.scaling.slice(0, 5);
    const item = (it, i) => {
      const running = need(it.detail.match(/([\d,]+) ads running/)?.[1], 'weekly running ads');
      const visits = it.detail.match(/([\d.]+[KMB]?) visits in (\w+ \d{4})/);
      return `<div class="it"><div class="rk">${i + 1}</div>
        ${it.logo ? `<img class="lg" src="${img(it.logo)}">` : ''}
        <div style="flex:1;min-width:0"><div class="nm">${esc(clip(it.name, 22))}</div><div class="dt">${running} ads live${visits ? ` · ${visits[1]} visits` : ''}</div></div>
        <div class="mt">${esc(it.metric.replace(' ads', ''))}<span>ads this week</span></div></div>`;
    };
    add({
      id: 'i04', concept: 'Listicle: top 5 stores adding the most Facebook ads this week (Monday report)', store: top.map(t => t.domain).join(', '), theme: 'dark',
      page: '/weekly',
      css: `.it{display:flex;align-items:center;gap:26px;padding:26px 30px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:26px;margin-top:16px}
        .rk{width:62px;height:62px;border-radius:18px;background:${LIME};color:${INK};font-weight:900;font-size:36px;display:grid;place-items:center;flex:none}
        .lg{width:64px;height:64px;border-radius:14px;background:#fff;object-fit:contain;flex:none}
        .nm{font-size:38px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dt{font-size:25px;opacity:.65;margin-top:4px;font-weight:500}
        .mt{font-size:46px;font-weight:900;color:${LIME};text-align:right;letter-spacing:-.02em}.mt span{display:block;font-size:20px;font-weight:600;color:#fff;opacity:.55;letter-spacing:0}`,
      bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#0f2412,${INK} 60%)"></div>`,
      body: `
        <div class="kick" style="color:${LIME}">${esc(week)} · The Monday report</div>
        <div style="font-size:78px;font-weight:900;letter-spacing:-.04em;line-height:1.02;margin:22px 0 26px">5 stores scaling their<br>Facebook ads this week</div>
        ${top.map(item).join('')}
        ${foot('', "margin-top:40px")}`,
      numbers: top.flatMap(t => [{ value: `${t.name}: ${t.metric} this week`, source_page: '/weekly' }, { value: t.detail.split(' · ').filter(x => /ads running|visits/.test(x)).join(' · '), source_page: '/weekly' }]),
      headline: 'Stores scaling their ads this week',
      description: 'The free Monday report for ecom sellers.',
      primary: `Every Monday AdLibrarySpy lists the stores that added the most Facebook ads that week, with their measured traffic. This week ${top[0].name} added ${top[0].metric.replace('+', '')}. It's how I spot what's working before everyone copies it. Sign up free and switch the report on. No card.`,
    });
  }

  // i05 — product photos from this month's fastest-growing stores.
  {
    const ps = D.trendProducts.slice(0, 6);
    add({
      id: 'i05', concept: 'Product grid: 6 products from this month\'s fastest-growing stores, with store growth', store: ps.map(p => p.domain).join(', '), theme: 'light',
      page: '/trending',
      css: `.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:40px 0}
        .card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(5,8,7,.08);position:relative}
        .card img{width:100%;aspect-ratio:1;object-fit:cover}
        .card .g{position:absolute;top:14px;left:14px;background:${INK};color:${LIME};font-weight:900;font-size:30px;padding:8px 16px;border-radius:14px}
        .card .s{padding:14px 18px 18px;font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
      bg: () => `<div style="position:absolute;inset:0;background:#f1f3ee"></div>`,
      body: `
        ${lockup()}
        <div style="font-size:78px;font-weight:900;letter-spacing:-.04em;line-height:1.02;margin-top:34px">What the fastest-growing<br>stores sell right now</div>
        <div class="grid">${ps.map(p => `<div class="card"><img src="${img(p.img)}"><div class="g">${esc(p.growth)}</div><div class="s">${esc(p.store)}</div></div>`).join('')}</div>
        <div class="src" style="margin:-16px 0 30px">Badge = the store's SimilarWeb visits, month over month (${esc(D.nichesPeriod)}).</div>
        ${cta('light')}`,
      numbers: ps.map(p => ({ value: `${p.store} ${p.growth} visits MoM`, source_page: '/trending' })),
      headline: 'Products from stores that just grew',
      description: 'Updated monthly from measured traffic. Free.',
      primary: `These products come from stores whose traffic jumped the most this month (${ps[0].store} is up ${ps[0].growth}). AdLibrarySpy ranks stores by measured SimilarWeb visits and shows what they sell, so you can see what's moving before you test it. Free, no card.`,
    });
  }

  // i06 — brandtracker competitor spy.
  {
    const t = D.tracker;
    add({
      id: 'i06', concept: 'Competitor spy: Brandtracker table (traffic + live ads, daily snapshots)', store: t.map(r => r[0][1].replace(' ↗', '')).join(', '), theme: 'lime',
      page: '/brandtracker',
      bg: () => `<div style="position:absolute;inset:0;background:${LIME}"></div><div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(5,8,7,.035) 0 2px,transparent 2px 22px)"></div>`,
      body: `
        <div class="kick" style="color:${INK};opacity:.7">Brandtracker</div>
        <div style="font-size:92px;font-weight:900;letter-spacing:-.045em;line-height:.98;margin:20px 0 44px;color:${INK}">Watch your competitors'<br>ads. Every day.</div>
        <div class="shot" style="background:#fff;box-shadow:0 30px 60px rgba(5,8,7,.25);border:3px solid ${INK}"><img src="${img(D.trackerShot)}"></div>
        <div style="font-size:34px;font-weight:700;margin:36px 0 36px;color:${INK}">Traffic and live ads, snapshotted daily. Track as many brands as you want.</div>
        ${foot('lime', "color:${INK}")}`,
      numbers: t.map(r => ({ value: `${r[0][0]}: ${r[1][0]} visits, ${r[2][0]} live ads`, source_page: '/brandtracker' })),
      headline: 'Track competitors\' ads daily',
      description: 'No brand cap. Free forever, no card.',
      primary: `Add a competitor to your Brandtracker and AdLibrarySpy records their traffic and live Facebook ads every day. You see when they scale up or pull back without checking the Ad Library by hand. There's no cap on brands, and your team can join free.`,
    });
  }

  // i07 — founder story as an iPhone Notes page.
  add({
    id: 'i07', concept: 'Native "Notes app" founder story', store: '—', theme: 'light',
    page: 'founder story (launch copy)',
    css: `.notes{background:#fffef8;border-radius:40px;box-shadow:0 30px 80px rgba(0,0,0,.18);padding:40px 56px 50px;font-family:-apple-system,"SF Pro Text",Inter,sans-serif}
      .nbar{display:flex;justify-content:space-between;color:#d9a400;font-size:32px;font-weight:600;margin-bottom:30px}
      .ndate{text-align:center;color:#9a9a9a;font-size:24px;margin-bottom:20px}
      .notes h1{font-size:60px;font-weight:800;letter-spacing:-.02em;margin-bottom:22px}
      .notes p{font-size:37px;line-height:1.36;margin-bottom:24px;color:#1b1b1b}`,
    bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#f2eee0,#e8e4d4)"></div>`,
    body: `
      <div class="notes"><div class="nbar"><span>‹ Notes</span><span>Done</span></div>
        <h1>why I built this</h1>
        <p>I started ecom with $300.</p>
        <p>Ad spy tools cost $200/month. That was my whole ad budget, so I guessed. Picked products blind, burned cash, almost quit.</p>
        <p>So I built <b>AdLibrarySpy</b>: a free TrendTrack alternative. Live ads, the stores behind them, their traffic.</p>
        <p style="margin-bottom:0">Free. No card. ✌️</p>
      </div>
      ${foot('light', "margin-top:40px")}`,
    numbers: [],
    headline: 'The ad spy tool I couldn\'t afford',
    description: 'A free TrendTrack alternative. No card.',
    primary: `I started ecom with $300. Ad spy tools cost $200/month, which was my whole ad budget, so I guessed and almost quit. So I built AdLibrarySpy, a free TrendTrack alternative: search live Meta ads, see the stores behind them, their traffic and products. Free, no credit card. If it saves one beginner from quitting, it's worth it.`,
  });

  // i08 — founder post as a dark social-post card, with 4 real creatives attached.
  {
    const four = D.ads.slice(1, 5);
    add({
      id: 'i08', concept: 'Native social-post (tweet-style) founder note with 4 real ad creatives attached', store: four.map(a => a.advertiser).join(', '), theme: 'dark',
      page: '/ads',
      css: `.post{background:#000;border:1px solid #2f3336;border-radius:36px;padding:44px}
        .who{display:flex;align-items:center;gap:20px}.av{width:88px;height:88px;border-radius:50%;background:${LIME};color:#071004;display:grid;place-items:center}.av svg{width:52px;height:52px}
        .nm{font-size:36px;font-weight:800}.hd{font-size:30px;color:#71767b}
        .tx{font-size:42px;line-height:1.32;margin:30px 0;font-weight:500}
        .media{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-radius:28px;overflow:hidden}
        .media img{width:100%;aspect-ratio:1.25;object-fit:cover}
        .f9 .media img:nth-child(n+3){display:none}`,
      bg: () => `<div style="position:absolute;inset:0;background:#0b0d0c"></div>`,
      body: `
        <div class="post"><div class="who"><div class="av">${TARGET}</div><div><div class="nm">AdLibrarySpy</div><div class="hd">@quantummaxing</div></div></div>
          <div class="tx">Ad spy tools cost $200/month. That was my whole ad budget.<br><br>So I built a free one. Every ad below is live in it.</div>
          <div class="media">${four.map(a => `<img src="${img(a.img)}">`).join('')}</div>
        </div>
        <div style="margin-top:40px">${cta()}</div>`,
      numbers: [],
      headline: 'So I built a free ad spy tool',
      description: 'Search live Meta ads. Free, no card.',
      primary: `Ad spy tools cost $200/month when I started, and that was my whole ad budget. So I built a free one. AdLibrarySpy lets you browse real Facebook ads, click through to the store running them and see its traffic and products. No card, no trial clock.`,
    });
  }

  // i09 — search any store: typed search bar + a result built from the dossier.
  {
    const s = S['gymshark.com'];
    add({
      id: 'i09', concept: 'Search-bar hero: type a store, get its dossier (visits, live ads, products)', store: s.domain, theme: 'light',
      page: s.href,
      css: `.sb{display:flex;align-items:center;gap:22px;background:#fff;border:3px solid ${INK};border-radius:30px;padding:30px 36px;font-size:48px;font-weight:700;box-shadow:0 14px 0 ${INK}}
        .sb svg{width:52px;height:52px}.caret{display:inline-block;width:4px;height:54px;background:${INK};margin-left:4px;vertical-align:middle}
        .res{background:#fff;border-radius:30px;margin-top:40px;padding:36px;box-shadow:0 30px 70px rgba(5,8,7,.14)}
        .st{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}
        .st div{background:#f2f5ee;border-radius:20px;padding:22px}.st b{display:block;font-size:52px;font-weight:900;letter-spacing:-.03em}.st span{font-size:24px;font-weight:600;opacity:.6}
        .pr{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.pr img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px}`,
      bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#e9f7da,#f6f7f3 55%)"></div>`,
      body: `
        <div style="font-size:86px;font-weight:900;letter-spacing:-.045em;line-height:1;margin-bottom:44px">Type any store.<br>See what's working.</div>
        <div class="sb">${SEARCH}<span>${esc(s.domain)}<span class="caret"></span></span></div>
        <div class="res"><div style="font-size:40px;font-weight:800">${esc(s.name)}</div>
          <div class="st"><div><b>${esc(s.visits)}</b><span>monthly visits</span></div><div><b>${n0(s.liveAds)}</b><span>live Meta ads</span></div>${s.productCount ? `<div><b>${n0(s.productCount)}</b><span>products</span></div>` : ''}</div>
          <div class="pr">${s.products.slice(0, 3).map(p => `<img src="${img(p.img)}">`).join('')}</div></div>
        ${foot('light', "margin-top:44px")}`,
      numbers: [{ value: `${s.visits} monthly visits`, source_page: s.href }, { value: `${n0(s.liveAds)} live Meta ads`, source_page: s.href }, ...(s.productCount ? [{ value: `${n0(s.productCount)} products`, source_page: s.href }] : [])],
      headline: 'Type any store. See what\'s working.',
      description: 'Traffic, live ads and products. Free.',
      primary: `Type a store into AdLibrarySpy and you get its monthly visits (SimilarWeb), how many Facebook ads it's running, its products and the apps and pixels it uses. ${s.name}: ${s.visits} visits a month, ${n0(s.liveAds)} live ads. Works for any of the ${(D.shopsIndexed / 1e6).toFixed(1)}M stores we index. Free, no card.`,
    });
  }

  // i10 — wall of real ad creatives from the library.
  {
    const wall = D.ads.slice(0, 12);
    add({
      id: 'i10', concept: 'Creative wall: grid of real ads from the ads library with a center message card', store: wall.map(a => a.advertiser).join(', '), theme: 'dark',
      page: '/ads',
      bg: f => {
        const cols = 3, w = f.W / cols, h = w * 1.25;
        const rows = Math.ceil(f.H / h) + 1;
        let out = '';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const a = wall[(r * cols + c) % wall.length];
          out += `<img src="${img(a.img)}" style="position:absolute;left:${c * w + 6}px;top:${r * h - (c % 2 ? h / 3 : 0) + 6}px;width:${w - 12}px;height:${h - 12}px;object-fit:cover;border-radius:18px">`;
        }
        return `<div style="position:absolute;inset:0;background:${INK}">${out}</div><div style="position:absolute;inset:0;background:rgba(5,8,7,.45)"></div>`;
      },
      body: `
        <div style="background:${INK};border:3px solid ${LIME};border-radius:40px;padding:56px 52px;box-shadow:0 40px 120px rgba(0,0,0,.6)">
          ${lockup()}
          <div style="font-size:92px;font-weight:900;letter-spacing:-.045em;line-height:1;margin:36px 0 22px">Real Facebook ads.<br><span class="hl">Free to search.</span></div>
          <div style="font-size:36px;font-weight:600;opacity:.8;line-height:1.3;margin-bottom:40px">Filter by niche, country and format. Open the store behind any ad.</div>
          ${cta()}
        </div>`,
      numbers: [],
      headline: 'Search real Facebook ads, free',
      description: 'See the store behind every ad. No card.',
      primary: `Every ad in the background is from AdLibrarySpy's ads library. Filter by niche, country, format or placement, save the ones you like, and click through to see the store behind each one, its traffic and its products. Free, no card.`,
    });
  }

  // i11 — store dossier card.
  {
    const s = S['resilia.shop'];
    add({
      id: 'i11', concept: 'Store dossier card: one store\'s visits, growth, live ads, pixels, apps and products', store: s.domain, theme: 'dark',
      page: s.href,
      css: `.dos{background:#0e1410;border:1px solid rgba(167,244,90,.25);border-radius:40px;padding:44px}
        .sg{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:34px 0}
        .sg div{background:rgba(255,255,255,.05);border-radius:24px;padding:26px 28px}.sg b{display:block;font-size:68px;font-weight:900;letter-spacing:-.04em;color:${LIME}}.sg span{font-size:26px;font-weight:600;opacity:.7}
        .pr{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.pr img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px;background:#fff}`,
      bg: () => `<div style="position:absolute;inset:0;background:radial-gradient(1000px 800px at 80% 10%,#1d3a12,${INK} 65%)"></div>`,
      body: `
        <div style="font-size:74px;font-weight:900;letter-spacing:-.04em;line-height:1.02;margin-bottom:38px">Everything a store runs on.<br><span class="hl">On one page.</span></div>
        <div class="dos"><div style="font-size:48px;font-weight:800">${esc(s.name)}</div><div style="font-size:28px;opacity:.6;margin-top:6px">${esc(s.domain)}</div>
          <div class="sg"><div><b>${esc(s.visits)}</b><span>visits / month${s.growth ? ` · ${esc(s.growth)}` : ''}</span></div><div><b>${n0(s.liveAds)}</b><span>live Meta ads</span></div>
            ${s.pixelCount ? `<div><b>${s.pixelCount}</b><span>tracking pixels</span></div>` : ''}${s.appCount ? `<div><b>${s.appCount}</b><span>apps & integrations</span></div>` : ''}</div>
          <div class="pr">${s.products.slice(0, 3).map(p => `<img src="${img(p.img)}">`).join('')}</div></div>
        ${foot('', "margin-top:40px")}`,
      numbers: [{ value: `${s.visits} monthly visits`, source_page: s.href }, ...(s.growth ? [{ value: `${s.growth} month over month`, source_page: s.href }] : []), { value: `${n0(s.liveAds)} live Meta ads`, source_page: s.href }, ...(s.pixelCount ? [{ value: `${s.pixelCount} pixels`, source_page: s.href }] : []), ...(s.appCount ? [{ value: `${s.appCount} apps & integrations`, source_page: s.href }] : [])],
      headline: 'Everything a store runs on, one page',
      description: 'Traffic, ads, products, pixels, apps. Free.',
      primary: `${s.name} gets ${s.visits} visits a month${s.growth ? ` (${s.growth})` : ''} and runs ${n0(s.liveAds)} Facebook ads. AdLibrarySpy shows that plus its products, ${s.pixelCount} tracking pixels and ${s.appCount} apps on one page. That's the whole playbook of a store in one look. Free, no card.`,
    });
  }

  // i12 — tech stack: pixels + apps card.
  {
    const s = S['glovbeauty.com'];
    need(s.stackCard, 'glov stack card');
    add({
      id: 'i12', concept: 'Tech-stack reveal: the pixels and apps a competitor runs (dossier card crop)', store: s.domain, theme: 'light',
      page: s.href,
      bg: () => `<div style="position:absolute;inset:0;background:#e6f3dc"></div><div style="position:absolute;left:-160px;bottom:-160px;width:620px;height:620px;border-radius:50%;background:${LIME};opacity:.55"></div>`,
      body: `
        ${lockup()}
        <div style="font-size:86px;font-weight:900;letter-spacing:-.045em;line-height:1;margin:34px 0 18px">See the apps and pixels<br>behind any store.</div>
        <div style="font-size:36px;font-weight:600;opacity:.7;margin-bottom:34px">${esc(s.domain)} runs ${s.pixelCount} pixels and ${s.appCount} apps:</div>
        <div class="shot" style="background:#fff;box-shadow:0 30px 60px rgba(5,8,7,.18)"><img src="${img(s.stackCard)}"></div>
        <div style="margin-top:40px">${cta('light')}</div>`,
      numbers: [{ value: `${s.pixelCount} pixels`, source_page: s.href }, { value: `${s.appCount} apps & integrations`, source_page: s.href }],
      headline: 'See the apps behind any store',
      description: 'Pixels, apps and integrations. Free.',
      primary: `Want to know which reviews app, email tool or pixels a store uses? AdLibrarySpy lists them on every store page. ${s.domain} runs ${s.pixelCount} pixels and ${s.appCount} apps, right next to its traffic and live Facebook ads. Free, no card.`,
    });
  }

  // i13 — two-panel meme, text-only.
  {
    const a = D.ads[4] || D.ads[0];
    add({
      id: 'i13', concept: 'Two-panel meme (no/yes format), text-only, tasteful', store: '—', theme: 'light',
      page: '/ads',
      css: `.pn{display:grid;grid-template-columns:200px 1fr;align-items:center;gap:36px;padding:44px}
        .ic{width:200px;height:200px;border-radius:40px;display:grid;place-items:center}.ic svg{width:110px;height:110px}
        .pt{font-size:56px;font-weight:800;letter-spacing:-.03em;line-height:1.1}`,
      bg: () => `<div style="position:absolute;inset:0;background:#fff"></div>`,
      body: `
        <div style="border:5px solid ${INK};border-radius:36px;overflow:hidden">
          <div class="pn" style="background:#eceeea"><div class="ic" style="background:#d4d8d2;color:#7b817c">${CROSS}</div>
            <div class="pt" style="color:#5f655f">Paying every month to see which ads are working</div></div>
          <div class="pn" style="background:${INK};color:#fff;border-top:5px solid ${INK}"><div class="ic" style="background:${LIME};color:${INK}">${CHECK}</div>
            <div class="pt">Seeing the same ads, the stores behind them and their traffic <span class="hl">for $0</span></div></div>
        </div>
        ${foot('light', "margin-top:50px")}`,
      numbers: [],
      headline: 'Stop paying to see what\'s working',
      description: 'Free ad spy for ecom. No card.',
      primary: `Stop paying every month just to see what's working. AdLibrarySpy is a free ad spy tool for ecom: search live Meta ads, see the Shopify stores behind them, their traffic and top products, and spot winners early. Free forever, no credit card.`,
    });
    void a;
  }

  // i14 — traffic chart: a store taking off.
  {
    const s = S['emmafy.com'];
    const [a, , c] = s.traffic;
    need(c, 'emmafy traffic points');
    add({
      id: 'i14', concept: 'Before/after traffic curve: one store\'s 3-month visits climb (dossier chart)', store: s.domain, theme: 'light',
      page: s.href,
      bg: () => `<div style="position:absolute;inset:0;background:#fafbf8"></div>`,
      body: `
        <div class="kick" style="opacity:.55">${esc(s.domain)} · SimilarWeb visits</div>
        <div style="font-size:150px;font-weight:900;letter-spacing:-.055em;line-height:.95;margin:20px 0 10px">${esc(a)} <span style="color:#9aa39a">→</span> <span style="background:${LIME};padding:0 16px;border-radius:24px">${esc(c)}</span></div>
        <div style="font-size:56px;font-weight:800;letter-spacing:-.03em;margin-bottom:40px">Spot stores before they blow up.</div>
        <div class="shot" style="box-shadow:0 24px 60px rgba(5,8,7,.14);border:2px solid #e3e7df"><img src="${img(s.trafficCard)}"></div>
        ${foot('light', "margin-top:42px")}`,
      numbers: s.traffic.map(t => ({ value: `${t} monthly visits`, source_page: s.href })).concat(s.growth ? [{ value: `${s.growth} MoM`, source_page: s.href }] : []),
      headline: 'Spot stores before they blow up',
      description: 'Store traffic trends next to live ads. Free.',
      primary: `${s.name} went from ${a} to ${c} monthly visits in two months (SimilarWeb). AdLibrarySpy shows every store's traffic trend next to its live Facebook ads, so you can see which products are taking off while it's still early. Free, no card.`,
    });
  }

  // i15 — newest winner: a young store already drawing real traffic.
  {
    const month = D.weekly.newest.map(it => ({ it, m: it.detail.match(/Store created (\d{4}-\d{2}-\d{2}) · ([\d.]+[KM]) visits in (\w+) (\d{4})/) })).filter(x => x.m);
    // A store that existed for the whole measured month, so the number is not a partial-month artefact.
    const pick = month.find(({ m }) => new Date(m[1]) < new Date(`${m[3]} 1, ${m[4]}`));
    need(pick, 'newest winner older than its measured month');
    const { it, m } = pick;
    const created = new Date(`${m[1]}T00:00:00Z`);
    const weeks = Math.floor((new Date(D.capturedAt) - created) / (7 * 864e5));
    const cd = created.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    add({
      id: 'i15', concept: 'Newest winner: a store created weeks ago that already draws real traffic (calendar card)', store: it.domain, theme: 'dark',
      page: '/weekly',
      css: `.cal{width:300px;border-radius:36px;overflow:hidden;background:#fff;color:${INK};text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.4)}
        .cal .m{background:${LIME};font-weight:900;font-size:34px;padding:16px;letter-spacing:.1em;text-transform:uppercase}.cal .d{font-size:150px;font-weight:900;letter-spacing:-.05em;line-height:1.1;padding:10px 0}.cal .y{font-size:28px;font-weight:700;opacity:.5;padding-bottom:22px}`,
      bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#12160f,${INK})"></div>`,
      body: `
        <div class="kick" style="color:${LIME}">Newest winners · ${esc(week)}</div>
        <div style="font-size:96px;font-weight:900;letter-spacing:-.045em;line-height:1;margin:24px 0 46px">This store is<br>${weeks} weeks old.</div>
        <div class="row" style="gap:44px;align-items:center">
          <div class="cal"><div class="m">${created.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</div><div class="d">${created.getUTCDate()}</div><div class="y">created ${created.getUTCFullYear()}</div></div>
          <div><div style="font-size:120px;font-weight:900;letter-spacing:-.05em;color:${LIME};line-height:1">${esc(m[2])}</div><div style="font-size:40px;font-weight:700">visits in ${esc(m[3])}</div>
            <div class="row" style="gap:16px;margin-top:22px">${it.logo ? `<img src="${img(it.logo)}" style="width:56px;height:56px;border-radius:12px;background:#fff">` : ''}<div style="font-size:34px;font-weight:700;opacity:.8">${esc(it.domain)}</div></div></div>
        </div>
        <div style="font-size:36px;font-weight:600;opacity:.75;margin:50px 0 44px">Find new stores while they're still new.</div>
        ${foot('', "")}`,
      numbers: [{ value: `created ${m[1]}`, source_page: '/weekly' }, { value: `${m[2]} visits in ${m[3]} ${m[4]}`, source_page: '/weekly' }, { value: `${weeks} weeks old (created → capture date)`, source_page: '/weekly' }],
      headline: `This store is ${weeks} weeks old`,
      description: 'Find new stores while they\'re still new.',
      primary: `${it.name} (${it.domain}) was created on ${cd} and had ${m[2]} visits in ${m[3]} (SimilarWeb). AdLibrarySpy's Monday report lists new stores like this every week, so you see them before everyone else does. Free, no card.`,
    });
  }

  // i16 — niche heating up.
  {
    const nb = [...D.niches].sort((a, b) => b.breakout - a.breakout)[0];
    add({
      id: 'i16', concept: 'Niche trend: how many stores in one niche grew 50%+ last month (Trends card)', store: `${nb.parent} › ${nb.name}`, theme: 'dark',
      page: '/trending',
      bg: () => `<div style="position:absolute;inset:0;background:${INK}"></div><div style="position:absolute;left:50%;top:40%;width:1100px;height:1100px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(167,244,90,.22),transparent 65%)"></div>`,
      body: `
        <div class="kick" style="color:${LIME}">Trending niches · ${esc(D.nichesPeriod)}</div>
        <div style="font-size:220px;font-weight:900;letter-spacing:-.055em;line-height:.95;margin:24px 0 10px;color:${LIME}">${n0(nb.breakout)}</div>
        <div style="font-size:64px;font-weight:800;letter-spacing:-.03em;line-height:1.08">${esc(nb.name)} stores grew<br>50%+ in one month.</div>
        <div class="shot" style="width:78%;margin:44px 0 44px;background:#fff;transform:rotate(1.5deg)"><img src="${img(nb.card)}"></div>
        ${foot('', "")}`,
      numbers: [{ value: `${n0(nb.breakout)} ${nb.name} stores grew ${nb.minGrowth}%+`, source_page: '/trending' }, { value: `${nb.share}% of ${n0(nb.measured)} measured stores`, source_page: '/trending' }],
      headline: 'See which niches are heating up',
      description: 'Measured traffic, updated monthly. Free.',
      primary: `${n0(nb.breakout)} ${nb.name} stores grew their traffic 50% or more last month (${nb.share}% of the ones we measure). AdLibrarySpy ranks every niche this way from SimilarWeb data and shows the stores leading each one. Pick your next niche from data, not guesses. Free, no card.`,
    });
  }

  // i17 — the size of the index, over a wall of real store domains.
  {
    const domains = [...new Set([...D.shopsRows.map(r => r[0][0]), ...Object.keys(S), ...['scaling', 'growth', 'peaks', 'newest', 'movers'].flatMap(k => (D.weekly[k] || []).map(x => x.domain)), ...D.trendProducts.map(p => p.domain)])];
    add({
      id: 'i17', concept: 'Scale statement: size of the store index over a typographic wall of real store domains', store: 'index', theme: 'lime',
      page: '/shops',
      bg: f => {
        const rows = Math.ceil(f.H / 64);
        let out = '';
        for (let r = 0; r < rows; r++) {
          const line = Array.from({ length: 8 }, (_, i) => domains[(r * 5 + i * 3) % domains.length]).join('   ·   ');
          out += `<div style="white-space:nowrap;font-size:40px;font-weight:800;line-height:64px;margin-left:${-((r * 137) % 500)}px">${esc(line)}</div>`;
        }
        return `<div style="position:absolute;inset:0;background:${LIME}"></div><div style="position:absolute;inset:0;color:rgba(5,8,7,.1)">${out}</div>`;
      },
      body: `
        <div style="background:${INK};color:#fff;border-radius:44px;padding:60px 56px">
          ${lockup()}
          <div style="font-size:150px;font-weight:900;letter-spacing:-.055em;line-height:1;margin:40px 0 10px;color:${LIME}">${n0(D.shopsIndexed)}</div>
          <div style="font-size:62px;font-weight:800;letter-spacing:-.03em;line-height:1.08">online stores. One free search.</div>
          <div style="font-size:34px;font-weight:600;opacity:.75;margin:26px 0 44px;line-height:1.3">Filter by niche, country, traffic, growth, products and the apps they use.</div>
          ${cta()}
        </div>`,
      numbers: [{ value: n0(D.shopsIndexed), source_page: '/shops' }],
      headline: `${(D.shopsIndexed / 1e6).toFixed(1)}M stores, one free search`,
      description: 'Filter by niche, traffic, growth and ads.',
      primary: `AdLibrarySpy indexes ${n0(D.shopsIndexed)} online stores. Filter by niche, country, traffic, growth, product count and the apps they run, then open any store to see its live Facebook ads. It's how I find stores worth studying. Free, no card.`,
    });
  }

  // i18 — advertiser with the most live ads, with its own creative.
  {
    const a = D.advertiser;
    const word = a.name.split(/\s+/)[0].toLowerCase();
    const own = D.ads.find(x => x.advertiser.toLowerCase().includes(word));
    add({
      id: 'i18', concept: 'Advertiser spotlight: the Facebook page with the most live ads, with one of its real creatives', store: a.name, theme: 'dark',
      page: '/advertisers',
      bg: () => `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#1a1410,${INK})"></div>`,
      body: `
        <div class="row" style="gap:44px;align-items:center">
          ${own ? `<div class="shot" style="width:40%;flex:none;transform:rotate(-2deg);border:4px solid #fff"><img src="${img(own.img)}"></div>` : ''}
          <div style="flex:1">
            <div class="kick" style="color:${LIME};font-size:26px">${esc(a.name)}</div>
            <div style="font-size:${own ? 150 : 220}px;font-weight:900;letter-spacing:-.055em;line-height:.95;margin:18px 0 12px;color:${LIME}">${n0(a.liveAds)}</div>
            <div style="font-size:50px;font-weight:800;letter-spacing:-.03em;line-height:1.08">Facebook ads live. From one advertiser.</div>
          </div>
        </div>
        <div class="row" style="gap:18px;margin:46px 0">
          ${a.launched14 ? `<div style="flex:1;background:rgba(255,255,255,.07);border-radius:24px;padding:26px"><div style="font-size:60px;font-weight:900">${n0(a.launched14)}</div><div style="font-size:26px;opacity:.65;font-weight:600">new ads in the last 14 days</div></div>` : ''}
          ${a.followers ? `<div style="flex:1;background:rgba(255,255,255,.07);border-radius:24px;padding:26px"><div style="font-size:60px;font-weight:900">${esc(a.followers)}</div><div style="font-size:26px;opacity:.65;font-weight:600">Facebook followers</div></div>` : ''}
        </div>
        <div style="font-size:36px;font-weight:600;opacity:.8;margin-bottom:40px">See every ad a brand runs, and what it launches next.</div>
        ${foot('', "")}`,
      numbers: [{ value: `${n0(a.liveAds)} live ads`, source_page: '/advertisers' }, ...(a.launched14 ? [{ value: `${a.launched14} ads launched in 14 days`, source_page: '/advertisers' }] : []), ...(a.followers ? [{ value: `${a.followers} followers`, source_page: '/advertisers' }] : [])],
      headline: `${a.name.split(' ')[0]} runs ${n0(a.liveAds)} ads`,
      description: 'See every ad any brand runs. Free.',
      primary: `${a.name} has ${n0(a.liveAds)} Facebook ads live${a.launched14 ? ` and launched ${a.launched14} new ones in the last 14 days` : ''}. On AdLibrarySpy you can see every advertiser like this, sorted by how many ads they run, with their landing pages and the store behind them. Free, no card.`,
    });
  }

  // i19 — the free feature list, from the comparison page.
  {
    const items = ['Meta ads library, searchable', 'Store traffic (SimilarWeb)', 'Live ad counts, every day', 'Products, pixels and apps', 'Brandtracker, no brand cap', 'Your whole team, free', 'Works inside Claude (MCP)'];
    add({
      id: 'i19', concept: 'Checklist: everything included free (from the comparison page), no plans or credits', store: '—', theme: 'dark',
      page: '/vs/trendtrack',
      css: `.ck{display:flex;align-items:center;gap:26px;font-size:46px;font-weight:700;letter-spacing:-.02em;padding:18px 0}
        .ck i{width:62px;height:62px;border-radius:50%;background:${LIME};color:${INK};display:grid;place-items:center;flex:none}.ck i svg{width:36px;height:36px}`,
      bg: () => `<div style="position:absolute;inset:0;background:${INK}"></div><div style="position:absolute;right:0;top:0;bottom:0;width:22px;background:${LIME}"></div>`,
      body: `
        <div style="font-size:104px;font-weight:900;letter-spacing:-.05em;line-height:.98;margin-bottom:36px">All of it.<br><span class="hl">Free.</span></div>
        ${items.map(t => `<div class="ck"><i>${CHECK}</i>${t}</div>`).join('')}
        <div style="font-size:32px;font-weight:600;opacity:.65;margin:30px 0 40px">No card. No trial clock. No credits that run out.</div>
        ${foot('', "")}`,
      numbers: [],
      headline: 'Every feature free. No card.',
      description: 'No plans, no trial clock, no credits.',
      primary: `Everything in AdLibrarySpy is free for every workspace: the Meta ads library, store traffic, daily live-ad counts, products, pixels and apps, a Brandtracker with no brand cap and free seats for your team. There are no plans, trials or credits, and you don't need a card.`,
    });
  }

  // i20 — three steps on one store.
  {
    const s = S['macorner.co'];
    const step = (n, t, inner) => `<div class="stp"><div class="sn">${n}</div><div style="flex:1;min-width:0"><div class="stt">${t}</div>${inner}</div></div>`;
    add({
      id: 'i20', concept: 'How-it-works storyboard: 3 steps on one store (find it, see traffic + ads, see products)', store: s.domain, theme: 'light',
      page: s.href,
      css: `.stp{display:flex;gap:30px;align-items:flex-start;background:#fff;border-radius:30px;padding:30px 34px;margin-top:18px;box-shadow:0 12px 30px rgba(5,8,7,.07)}
        .sn{width:70px;height:70px;border-radius:50%;background:${INK};color:${LIME};font-weight:900;font-size:38px;display:grid;place-items:center;flex:none}
        .stt{font-size:42px;font-weight:800;letter-spacing:-.02em;margin:10px 0 14px}
        .pl{display:inline-flex;align-items:center;gap:14px;background:#f1f4ed;border-radius:18px;padding:14px 22px;font-size:32px;font-weight:700}.pl svg{width:34px;height:34px}
        .nb{display:flex;gap:40px}.nb b{font-size:62px;font-weight:900;letter-spacing:-.03em}.nb span{display:block;font-size:24px;font-weight:600;opacity:.6}
        .pr{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.pr img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px}`,
      bg: () => `<div style="position:absolute;inset:0;background:#edf0e8"></div>`,
      body: `
        ${lockup()}
        <div style="font-size:80px;font-weight:900;letter-spacing:-.04em;line-height:1.02;margin:32px 0 22px">Research any competitor<br>in 3 steps.</div>
        ${step(1, 'Search the store', `<div class="pl">${SEARCH}${esc(s.domain)}</div>`)}
        ${step(2, 'See its traffic and ads', `<div class="nb"><div><b>${esc(s.visits)}</b><span>visits / month</span></div><div><b>${n0(s.liveAds)}</b><span>live Meta ads</span></div></div>`)}
        ${step(3, 'See what it sells', `<div class="pr">${s.products.slice(0, 3).map(p => `<img src="${img(p.img)}">`).join('')}</div>`)}
        <div style="margin-top:36px">${cta('light')}</div>`,
      numbers: [{ value: `${s.visits} monthly visits`, source_page: s.href }, { value: `${n0(s.liveAds)} live Meta ads`, source_page: s.href }],
      headline: 'Research any competitor in 3 steps',
      description: 'Search a store. See traffic, ads, products.',
      primary: `Here's how I research a competitor: search the store, check its traffic and live Facebook ads, then look at what it sells. ${s.name}: ${s.visits} visits a month, ${n0(s.liveAds)} ads live. AdLibrarySpy puts all three on one page, for any store. Free, no card.`,
    });
  }
  // 9:16 only: the bottom 35% sits under the Reels/Stories UI, so it carries no key
  // content — just a strip of real imagery that fades into the background, so the
  // frame doesn't read as empty. Each ad gets its own set of images.
  const DECO = {
    i01: ['ads', 0, INK], i02: ['products', 0, '#f7f8f5'], i03: ['weekly', 0, '#f5f6f2'], i04: ['weekly', 4, INK],
    i05: ['weekly', 2, '#f1f3ee'], i06: ['ads', 4, LIME], i07: ['products', 6, '#e8e4d4'], i08: ['ads', 8, '#0b0d0c'],
    i09: ['products', 3, '#f6f7f3'], i11: ['store', 'resilia.shop', INK], i12: ['products', 9, '#e6f3dc'],
    i13: ['ads', 11, '#fff'], i14: ['store', 'emmafy.com', '#fafbf8'], i15: ['weekly', 6, INK], i16: ['products', 1, INK],
    i18: ['ads', 2, INK], i19: ['ads', 6, INK], i20: ['store', 'macorner.co', '#edf0e8'],
  };
  const pool = {
    ads: D.ads.map(a => a.img), products: D.trendProducts.map(p => p.img), weekly: (D.weekly.products || []).map(p => p.img),
  };
  for (const c of C) {
    const d = DECO[c.id];
    if (!d) continue;
    const [kind, arg, fade] = d;
    const srcs = kind === 'store' ? S[arg].products.map(p => p.img) : pool[kind];
    if (!srcs.length) continue;
    const pick = Array.from({ length: 4 }, (_, i) => srcs[(Number(arg) || 0) + i < srcs.length && kind !== 'store' ? (Number(arg) || 0) + i : i % srcs.length]);
    c.deco = f => {
      const y0 = f.H - f.bottom + 60, w = 300, h = kind === 'ads' ? 375 : 300;
      const tiles = pick.map((src, i) => `<img src="${img(src)}" style="position:absolute;left:${-40 + i * 290}px;top:${y0 + 40 + (i % 2) * 70}px;width:${w}px;height:${h}px;object-fit:cover;border-radius:28px;background:#fff;transform:rotate(${[-7, 5, -4, 8][i]}deg);box-shadow:0 20px 50px rgba(0,0,0,.3)">`).join('');
      return `<div style="position:absolute;inset:0;opacity:.55">${tiles}</div><div style="position:absolute;left:0;right:0;top:${y0 - 40}px;height:260px;background:linear-gradient(${fade},transparent)"></div>`;
    };
  }
  return C;
}

// -------------------------------------------------------------------- render ---
function pageHtml(c, f) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=block" rel="stylesheet">
<style>${BASE_CSS}
html,body{width:${f.W}px;height:${f.H}px}
#safe{left:${f.side}px;right:${f.side}px;top:${f.top}px;bottom:${f.bottom}px}
${c.css || ''}</style></head>
<body class="${c.theme}${f.suffix ? ' f9' : ''}"><div id="bg">${c.bg(f)}${f.suffix && c.deco ? c.deco(f) : ''}</div><div id="safe"><div id="fit">${c.body}</div></div></body></html>`;
}

export async function render({ WORK, OUT, chromium, ONLY_IDS }) {
  const D = JSON.parse(fs.readFileSync(path.join(WORK, 'data.json'), 'utf8'));
  const pagesDir = path.join(WORK, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  const img = f => { need(f, 'image'); const p = path.join(WORK, f); if (!fs.existsSync(p)) throw new Error(`render: missing capture ${f}`); return `../${f}`; };
  const all = concepts(D, img);
  if (all.length !== 20 || new Set(all.map(c => c.id)).size !== 20) throw new Error('render: expected 20 distinct concepts');
  for (const c of all) for (const [k, max] of [['primary', 400], ['headline', 40], ['description', 60]]) if (c[k].length > max) throw new Error(`${c.id} ${k} is ${c[k].length} chars (max ${max})`);
  const list = ONLY_IDS ? all.filter(c => ONLY_IDS.has(c.id)) : all;

  const browser = await chromium.launch({ channel: 'chromium' });
  const report = [];
  try {
    for (const c of list) for (const [fmt, f] of Object.entries(FORMATS)) {
      const file = path.join(pagesDir, `${c.id}_${fmt}.html`);
      fs.writeFileSync(file, pageHtml(c, f));
      const page = await browser.newPage({ viewport: { width: f.W, height: f.H }, deviceScaleFactor: 1 });
      await page.goto(`file://${file}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const broken = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
      if (broken.length) throw new Error(`${c.id} ${fmt}: images failed: ${broken.join(', ')}`);
      // Fit the content block into the safe box (never upscale), and prove it landed inside.
      const scale = await page.evaluate(() => {
        const box = document.getElementById('safe'), fit = document.getElementById('fit');
        // transform, not zoom: zoom reflows (width:100% images grow back to full size).
        const s = Math.min(1, box.clientHeight / fit.scrollHeight, box.clientWidth / fit.scrollWidth);
        fit.style.flex = 'none';
        fit.style.transform = `scale(${s})`;
        const r = fit.getBoundingClientRect(), b = box.getBoundingClientRect();
        if (r.top < b.top - 1 || r.bottom > b.bottom + 1) throw new Error(`content ${r.top}-${r.bottom} outside safe box ${b.top}-${b.bottom}`);
        return s;
      });
      const out = path.join(OUT, `${c.id}${f.suffix}.jpg`);
      for (const q of [90, 86, 82, 78]) {
        await page.screenshot({ path: out, type: 'jpeg', quality: q });
        if (fs.statSync(out).size < 1_000_000) break;
      }
      const kb = Math.round(fs.statSync(out).size / 1024);
      if (kb >= 1000) throw new Error(`${out} is ${kb} KB`);
      report.push(`${c.id} ${fmt.padEnd(4)} fit ${scale.toFixed(2)}  ${kb} KB${scale < 0.72 ? '  <- small' : ''}`);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(report.join('\n'));

  // Manifest: copy + every number shown, with the page it came from.
  const manifest = all.map(c => {
    return { id: c.id, file_4x5: `${c.id}.jpg`, file_9x16: `${c.id}_9x16.jpg`, concept: c.concept, store: c.store, primary_text: c.primary, headline: c.headline, description: c.description,
      numbers_shown: c.numbers.map(x => ({ value: x.value, source_page: `${x.source_page.startsWith('/') ? 'https://adlibraryspy.com' : ''}${x.source_page}` })) };
  });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ captured_at: D.capturedAt, ads: manifest }, null, 2));

  // QA contact sheets.
  const py = `
import sys
from PIL import Image, ImageDraw
out, suffix, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
ids = [f"i{n:02d}" for n in range(1, 21)]
ims = [Image.open(f"{out}/{i}{suffix}.jpg") for i in ids]
th = int(ims[0].height * w / ims[0].width)
sheet = Image.new('RGB', (5 * (w + 12) + 12, 4 * (th + 44) + 12), '#222')
d = ImageDraw.Draw(sheet)
for k, (i, im) in enumerate(zip(ids, ims)):
    x, y = 12 + (k % 5) * (w + 12), 12 + (k // 5) * (th + 44)
    sheet.paste(im.resize((w, th), Image.LANCZOS), (x, y + 32))
    d.text((x, y + 6), i, fill='#fff')
sheet.save(f"{out}/contact{suffix or '_4x5'}.jpg", quality=85)
`;
  if (!ONLY_IDS) for (const sfx of ['', '_9x16']) execFileSync('python3', ['-c', py, OUT, sfx, '360'], { stdio: 'inherit' });
  console.log(`manifest + contact sheets → ${OUT}`);
}
