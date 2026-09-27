// Composer for the v2 video set (scripts/fb-video-v2.mjs): 20 vertical ads
// built from a few creative ANGLES crossed with real stores.
//
// A video is a spec: a store, an angle, a look (accent, hook layout, transition),
// a music setting (tempo, key, progression, groove) and a list of scenes whose
// lengths are counted in beats, so every cut lands on the beat. The scenes are
// built only from captured production data (v2/.work/cap): a spec whose store
// lacks a figure throws instead of rendering, and every number on screen is
// listed in manifest.json with the page it came from.
//
// Motion design is one HTML page per video whose renderAt(t) sets every
// transform from t alone, so a frame is a pure function of time; Chromium
// screenshots each 1/30s into ffmpeg. The music is synthesized by ffmpeg's own
// aevalsrc (no samples, no third-party audio). Encoding is two-pass so each file
// fits under 9 MB (a 10 MB browser upload) at ~3.4-3.8 Mbps.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const LIME = '#a7f45a', INK = '#050807';
const W = 1080, H = 1920, FPS = 30;
// Safe zone for key text on 9:16 (Reels/Stories UI) that also survives Meta's
// 4:5 centre crop for feeds (y 285..1635): 14% from the top, 35% from the bottom.
const SAFE = { top: Math.round(H * 0.14), bottom: Math.round(H * 0.65), left: 40, right: W - 40 };
// Landscape (the homepage product tour): caption column on the left, the panel
// of real crops on the right; no platform UI overlays it, so the safe zone is a margin.
const GEO = {
  portrait: { W, H, SAFE, PANEL: { top: 560, maxH: 680, w: 960 }, cols: 4 },
  landscape: { W: 1920, H: 1080, SAFE: { top: 50, bottom: 1030, left: 60, right: 1860 }, PANEL: { x: 840, top: 130, maxH: 820, w: 1000 }, cols: 6 },
};
const MAX_BYTES = 9_000_000;
const SITE = 'https://adlibraryspy.com';

const ACCENT = { lime: LIME, cyan: '#62e3ff', amber: '#ffc24b', coral: '#ff8a5c', pink: '#ff79c6', violet: '#b69cff', mint: '#5ef2b0' };

// ------------------------------------------------------------- formatting ---
const int = n => Number(n).toLocaleString('en-US');
const compact = n => n >= 1e6 ? `${(Math.floor(n / 1e5) / 10).toFixed(1)}M` : n >= 1e4 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : int(n);
const pct = s => s.replace('−', '-');                                  // "+56.9%"
const roundPct = s => { const v = Number(pct(s).replace(/[^0-9.\-+]/g, '')); return `${v >= 0 ? '+' : ''}${Math.round(v)}%`; };
const dossierUrl = S => S.dossier;
const shopsUrl = S => `${SITE}/shops?q=${S.store}`;
const needS = (S, k) => { if (S[k] == null || S[k] === '') throw new Error(`${S.store}: ${k} missing`); return S[k]; };
// Positive, measured growth only (the ad never quotes a decline).
const growthOf = S => { const g = pct(needS(S, 'visitsGrowth')); if (!g.startsWith('+')) throw new Error(`${S.store}: growth ${g} is not a gain`); return g; };
const seriesEnds = s => ({ a: { ...s[0], t: short(s[0].t) }, b: { ...s.at(-1), t: short(s.at(-1).t) } });
const risingAds = S => { const { a, b } = seriesEnds(S.liveAdsSeries); if (b.v <= a.v) throw new Error(`${S.store}: ad count is not rising (${a.v} -> ${b.v})`); return { a, b }; };
const days = (a, b) => Math.round((Date.parse(b.t) - Date.parse(a.t)) / 864e5);
const short = t => t.replace(/, \d{4}$/, '');                           // "Sep 14, 2026" -> "Sep 14"

// ------------------------------------------------------------------ scenes ---
// Each builder returns { kind, beats, ...params }. Captions: <b>…</b> = accent.
const hook = (beats, p) => ({ kind: 'hook', beats, ...p });
const cap = (kicker, head) => ({ kicker, head });
const panelRow = (beats, S, c, ring = 'rowAds') => ({ kind: 'panel', beats, ...c, imgs: [{ src: 'shop_head.png' }, { src: 'shop_row.png', id: 'row' }],
  cam: [{ cx: .1, cy: .5, z: 2.7 }, { cx: ring === 'rowAds' ? .85 : .45, cy: .5, z: 2.7 }], hFromZ: true,
  rings: [{ img: 'row', r: S.rings[ring], at: .55 }] });
const panelVisits = (beats, S, c) => ({ kind: 'panel', beats, ...c, sheetW: 1290, pad: 48,
  imgs: [{ src: 'dossier_head.png' }, { src: 'visits.png', id: 'visits', inset: true }],
  cam: [{ cx: .5, cy: 0, z: 1 }, { ring: 0, z: 2.1 }], rings: [{ img: 'visits', r: S.rings.visits, at: .5 }] });
const panelLiveAds = (beats, S, c, pull = true) => ({ kind: 'panel', beats, ...c, imgs: [{ src: 'liveads.png', id: 'la' }],
  cam: pull ? [{ ring: 0, z: 2.1 }, { cx: .5, cy: .5, z: 1.02 }] : [{ cx: .5, cy: .5, z: 1.02 }, { ring: 0, z: 2.1 }], rings: [{ img: 'la', r: S.rings.liveads, at: pull ? .05 : .45 }] });
const panelTraffic = (beats, c) => ({ kind: 'panel', beats, ...c, imgs: [{ src: 'traffic.png' }], cam: [{ cx: .35, cy: .55, z: 1.3 }, { cx: .5, cy: .5, z: 1.0 }] });
const panelProducts = (beats, c) => ({ kind: 'panel', beats, ...c, imgs: [{ src: 'products.png' }], cam: [{ cx: .5, cy: 0, z: 1.06 }, { cx: .5, cy: .4, z: 1.06 }] });
const panelImg = (beats, src, c, cam) => ({ kind: 'panel', beats, ...c, imgs: [{ src, from: '_shared' }], cam });
const wallScene = (beats, c) => ({ kind: 'wall', beats, ...c });
const stat = (beats, p) => ({ kind: 'stat', beats, ...p });
const end = (beats, p) => ({ kind: 'end', beats, ...p });

// ------------------------------------------------------------------ videos ---
// store: the capture folder; ctx gets (S = that store's data, X = shared data).
// music: bpm, root (bass Hz), prog [[semitones, 'm'|'M'] x4], groove 'four'|'half', arp order.
const AM = [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']];          // i-VI-III-VII
const POP = [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']];           // I-V-vi-IV
const DARK = [[0, 'm'], [0, 'm'], [-4, 'M'], [-5, 'M']];        // i-i-VI-V
const LIFT = [[0, 'm'], [5, 'm'], [-2, 'M'], [3, 'M']];         // i-iv-VII-III

const TICKS = X => ['Free, no plans', 'No credit card', `${compact(X.shopsIndexed)} stores indexed`];

export const VIDEOS = [
  { id: 'v01', store: 'mellowsleep.com', angle: 'live-ad-count', accent: 'lime', tr: 'up', thumb: 1.6,
    music: { bpm: 124, root: 55, prog: AM, groove: 'four', arp: [0, 1, 2, 3] },
    build: (S, X) => {
      const { a, b } = risingAds(S);
      return {
        scenes: [
          hook(5, { layout: 'center', wall: 'lib', pre: 'This Shopify store is running', num: int(S.liveAds), post: 'Facebook ads<br>right now', chip: S.store }),
          panelRow(3, S, cap('Shop search', 'Find the store <b>behind the ads</b>')),
          stat(4, { kicker: 'Live Meta ads', head: `<b>${compact(a.v)} → ${compact(b.v)}</b> in ${days(a, b)} days`, series: S.liveAdsSeries }),
          panelVisits(3, S, cap(`Traffic · SimilarWeb`, `<b>${S.visits}</b> visits a month`)),
          panelProducts(3, cap('Products', 'Every <b>product</b> they sell')),
          end(12, { style: 'lockup', line: 'The <b>free</b><br>TrendTrack<br>alternative', ticks: TICKS(X) }),
        ],
        numbers: [[int(S.liveAds), dossierUrl(S)], [`${compact(a.v)} → ${compact(b.v)} (${a.t} → ${b.t})`, dossierUrl(S)], [S.visits, dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `This Shopify store is running ${int(S.liveAds)} Facebook ads right now`,
        copy: {
          primary: `${S.store} has ${int(S.liveAds)} Facebook ads live right now. On ${a.t} it was ${int(a.v)}. I built AdLibrarySpy so you can look up any Shopify store and see its live ad count, traffic and products. It's free, no card needed.`,
          headline: 'See any store\'s live Facebook ads', description: 'Free ad spy tool for Shopify sellers. No card.' },
      };
    } },

  { id: 'v02', store: 'resilia.shop', angle: 'traffic', accent: 'cyan', tr: 'whip', thumb: 1.5,
    music: { bpm: 118, root: 61.74, prog: DARK, groove: 'four', arp: [0, 2, 1, 3] },
    build: (S, X) => ({
      scenes: [
        hook(5, { layout: 'left', wall: S.ownAds >= 6 ? 'own' : 'lib', kicker: 'Monthly visits', pre: 'This supplement store gets', num: S.visits, post: 'visits a month', src: S.visitsSource, chip: S.store }),
        S.ownAds >= 6 ? wallScene(4, cap('Their ads', 'Here are the <b>ads they run</b>')) : wallScene(4, cap('Ads library', 'Browse real <b>Facebook ads</b>')),
        panelLiveAds(4, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> ads live now`)),
        panelTraffic(3, cap('Traffic over time', 'Month by month, <b>measured</b>')),
        end(12, { style: 'inverted', line: 'See any store\'s<br><b>traffic.</b> Free.', ticks: TICKS(X) }),
      ],
      numbers: [[S.visits, dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `This supplement store gets ${S.visits} visits a month`,
      copy: {
        primary: `${S.store} gets ${S.visits} visits a month (SimilarWeb) and has ${int(S.liveAds)} Facebook ads live. AdLibrarySpy shows you both for any Shopify store, next to the ads themselves. I made it free: sign up with your email, no card.`,
        headline: 'Traffic + ads for any Shopify store', description: 'SimilarWeb visits and live Meta ads. Free.' },
    }) },

  { id: 'v03', store: 'emmafy.com', angle: 'growth', accent: 'amber', tr: 'zoom', thumb: 1.7,
    music: { bpm: 128, root: 65.41, prog: POP, groove: 'four', arp: [0, 1, 2, 1] },
    build: (S, X) => ({
      scenes: [
        hook(6, { layout: 'outline', wall: S.ownAds >= 6 ? 'own' : 'lib', pre: 'This store\'s traffic grew', num: roundPct(growthOf(S)), post: 'in one month', src: 'SimilarWeb · Jul → Aug 2026', chip: S.store }),
        panelTraffic(4, cap('Traffic · SimilarWeb', `<b>${S.visits}</b> visits in August`)),
        S.ownAds >= 6 ? wallScene(4, cap('Their ads', 'The ads they\'re <b>running now</b>')) : wallScene(4, cap('Ads library', 'Browse real <b>Facebook ads</b>')),
        panelLiveAds(4, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> live ads`)),
        end(12, { style: 'lockup', line: 'Find the next<br><b>breakout</b> store', ticks: TICKS(X), cta: 'Start free' }),
      ],
      numbers: [[roundPct(growthOf(S)), dossierUrl(S)], [S.visits, dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `This store's traffic grew ${roundPct(growthOf(S))} in one month`,
      copy: {
        primary: `${S.store} went ${roundPct(growthOf(S))} in visits from July to August (SimilarWeb), to ${S.visits} a month, with ${int(S.liveAds)} Facebook ads live. AdLibrarySpy lets you sort 14 million stores by growth and open the ads behind each one. Free, no card.`,
        headline: 'Find stores before they peak', description: 'Sort Shopify stores by traffic growth. Free.' },
    }) },

  { id: 'v04', store: 'frostbuddy.com', angle: 'best-seller', accent: 'coral', tr: 'up', thumb: 1.8,
    music: { bpm: 112, root: 49, prog: LIFT, groove: 'half', arp: [0, 1, 2, 3] },
    build: (S, X) => {
      const p = S.bestSellers && S.products[0];
      if (!p || p.rank !== 1 || !p.price) throw new Error(`${S.store}: no ranked #1 with a price`);
      return {
        scenes: [
          { kind: 'product', beats: 6, kicker: 'Best seller #1', head: `Their #1 product costs <b>${p.price.replace(/\.00$/, '')}</b>`, title: p.title, price: p.price, chip: S.store },
          panelProducts(4, cap('Best sellers', 'Their <b>best sellers</b>, ranked')),
          stat(4, { kicker: 'Live Meta ads', head: `<b>${int(S.liveAds)}</b> Facebook ads live`, big: int(S.liveAds), sub: 'Meta Ad Library, today' }),
          end(12, { style: 'split', line: 'See what\'s<br><b>selling.</b>', ticks: TICKS(X) }),
        ],
        numbers: [[p.price, dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `Their #1 product costs ${p.price.replace(/\.00$/, '')}`,
        copy: {
          primary: `The #1 best seller at ${S.store} is the ${p.title}, at ${p.price}. The store has ${int(S.liveAds)} Facebook ads live. AdLibrarySpy shows each store's best sellers in their ranked order, with prices, next to its ads. Free to use, no card.`,
          headline: 'See any store\'s best sellers', description: 'Ranked products, prices and live ads. Free.' },
      };
    } },

  { id: 'v05', store: 'comfrt.com', angle: 'best-seller', accent: 'pink', tr: 'whip', thumb: 1.7,
    music: { bpm: 120, root: 55, prog: POP, groove: 'four', arp: [3, 2, 1, 0] },
    build: (S, X) => {
      const p = S.bestSellers && S.products[0];
      if (!p || p.rank !== 1 || !p.price) throw new Error(`${S.store}: no ranked #1 with a price`);
      const price = p.price.replace(/\.00$/, '');
      return {
        scenes: [
          hook(5, { layout: 'stack', wall: 'lib', kicker: 'Best seller #1', pre: `${S.storeName}'s top product is`, num: price, post: p.title, chip: S.store }),
          { kind: 'product', beats: 4, kicker: 'Ranked #1', head: `The <b>${p.title}</b>`, title: p.title, price: p.price },
          panelProducts(4, cap('Best sellers', 'The rest of their <b>top 6</b>')),
          panelVisits(3, S, cap('Traffic · SimilarWeb', `<b>${S.visits}</b> visits a month`)),
          end(12, { style: 'lockup', line: 'See what\'s<br><b>selling</b><br>anywhere', ticks: TICKS(X) }),
        ],
        numbers: [[price, dossierUrl(S)], [S.visits, dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `${S.storeName}'s top product is ${price}: ${p.title}`,
        copy: {
          primary: `Comfrt's #1 best seller right now is the ${p.title} at ${p.price}. The store gets ${S.visits} visits a month. I built AdLibrarySpy to show this for any Shopify store: ranked best sellers, traffic and live Facebook ads. Free, no card.`,
          headline: 'What\'s selling on Shopify right now', description: 'Best sellers, traffic, live ads. Free.' },
      };
    } },

  { id: 'v06', store: null, angle: 'price-vs-trendtrack', accent: 'lime', tr: 'up', thumb: 3.2,
    music: { bpm: 100, root: 43.65, prog: DARK, groove: 'half', arp: [0, 2, 1, 3] },
    build: (S, X) => ({
      scenes: [
        hook(4, { layout: 'words', wall: 'lib', words: 'Stop paying for an <b>ad spy</b> tool' }),
        { kind: 'price', beats: 8, rows: [['Starter', '$49'], ['Pro', '$89'], ['Business', '$159']], checked: X.vsChecked },
        panelImg(4, 'vs_price.png', cap('Side by side', 'Checked on <b>their own</b> pricing page'), [{ cx: .5, cy: .5, z: 1.9 }, { cx: .75, cy: .6, z: 1.9 }]),
        end(10, { style: 'inverted', line: '<b>$0.</b> Same<br>shop data.', ticks: ['No card', 'No lookup caps', `${compact(X.shopsIndexed)} stores indexed`] }),
      ],
      numbers: [['TrendTrack $49 / $89 / $159 per month', `${SITE}/vs/trendtrack`], ['$0', `${SITE}/vs/trendtrack`], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: 'Stop paying for an ad spy tool',
      copy: {
        primary: `TrendTrack's plans are $49, $89 and $159 a month (their pricing page, billed monthly). AdLibrarySpy is free: shop explorer with SimilarWeb traffic, Meta ads library, Brandtracker. It doesn't have Google or TikTok ads yet, and the comparison page says so. No card to sign up.`,
        headline: 'The free TrendTrack alternative', description: 'Shop explorer + Meta ads library. $0, no card.' },
    }) },

  { id: 'v07', store: null, angle: 'brandtracker', accent: 'violet', tr: 'zoom', thumb: 1.4,
    music: { bpm: 116, root: 73.42, prog: AM, groove: 'four', arp: [0, 1, 2, 3] },
    build: (S, X) => {
      const [first] = X.tracker;
      return {
        scenes: [
          hook(4, { layout: 'words', wall: 'lib', words: 'Spy on your <b>competitors</b>', sub: 'Traffic and live ads, recorded daily' }),
          { kind: 'panel', beats: 6, kicker: 'Brandtracker', head: 'Every brand you track, <b>one table</b>', imgs: [{ src: 'brandtracker.png', from: '_shared', id: 'bt' }],
            cam: [{ cx: 0, cy: .3, z: 2.3 }, { ring: 0, z: 1.9 }], hFromZ: true, rings: [{ img: 'bt', r: X.rings.tracker, at: .5 }] },
          { kind: 'tally', beats: 5, title: 'Monthly visits, tracked daily', items: X.tracker.slice(0, 3).map(r => ({ label: r[0], value: r[1], note: 'SimilarWeb' })) },
          end(11, { style: 'lockup', line: 'Track every<br><b>competitor.</b><br>Free.', ticks: ['No brand cap', 'Daily snapshots', 'No credit card'] }),
        ],
        numbers: [[`${first[0]}: ${first[2]} live ads`, `${SITE}/brandtracker`], ...X.tracker.slice(0, 3).map(r => [`${r[0]}: ${r[1]} visits`, `${SITE}/brandtracker`])],
        hookText: 'Spy on your competitors',
        copy: {
          primary: `Add a competitor to Brandtracker and AdLibrarySpy records its traffic and live Facebook ad count every day, with no cap on how many brands you track. Right now ${first[0]} has ${first[2]} ads live. Free, no card.`,
          headline: 'Track your competitors\' ads daily', description: 'Brandtracker: no brand cap, free.' },
      };
    } },

  { id: 'v08', store: 'goda.co', angle: 'pov-chat', accent: 'mint', tr: 'up', thumb: 2.6,
    music: { bpm: 96, root: 55, prog: LIFT, groove: 'half', arp: [0, 2, 1, 3] },
    build: (S, X) => ({
      scenes: [
        { kind: 'chat', beats: 8, pov: 'POV: you finally check your competitor', msgs: [
          { me: true, html: `how many ads is ${S.store} running?` },
          { me: false, html: `<b>${int(S.liveAds)}</b> live Facebook ads` },
          { me: true, html: 'and traffic??' },
          { me: false, html: `<b>${S.visits}</b> visits a month, <b>${roundPct(growthOf(S))}</b>` } ] },
        panelLiveAds(4, S, cap('Live Meta ads', 'Their ad count, <b>every day</b>')),
        panelProducts(4, cap('Products', 'And <b>what</b> they sell')),
        end(12, { style: 'split', line: 'Check yours.<br><b>Free.</b>', ticks: TICKS(X) }),
      ],
      numbers: [[int(S.liveAds), dossierUrl(S)], [S.visits, dossierUrl(S)], [roundPct(growthOf(S)), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `POV: you finally check your competitor (${S.store}: ${int(S.liveAds)} live ads)`,
      copy: {
        primary: `I looked up ${S.store}: ${int(S.liveAds)} Facebook ads live, ${S.visits} visits a month, up ${roundPct(growthOf(S)).slice(1)} since July. AdLibrarySpy gives you that for any Shopify store in a few seconds. Free, sign up with just your email.`,
        headline: 'Check your competitor in 5 seconds', description: 'Live ads, traffic, products. Free, no card.' },
    }) },

  { id: 'v09', store: 'wuffes.com', angle: 'checklist', accent: 'amber', tr: 'whip', thumb: 3.0,
    music: { bpm: 108, root: 65.41, prog: POP, groove: 'half', arp: [0, 1, 2, 3] },
    build: (S, X) => ({
      scenes: [
        { kind: 'check', beats: 9, title: 'Before you launch a pet product, check the leader', chip: S.store, items: [
          { label: 'Monthly visits', value: S.visits, note: 'SimilarWeb' },
          { label: 'Growth, Jul → Aug', value: roundPct(growthOf(S)), note: 'SimilarWeb' },
          { label: 'Live Facebook ads', value: int(S.liveAds), note: 'Meta Ad Library' },
          { label: 'What they sell', value: 'Products', note: 'Their storefront' } ] },
        panelVisits(3, S, cap('Traffic · SimilarWeb', `<b>${S.visits}</b> visits a month`)),
        panelLiveAds(3, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> ads live`)),
        end(11, { style: 'lockup', line: 'Do your<br><b>homework</b><br>free', ticks: TICKS(X) }),
      ],
      numbers: [[S.visits, dossierUrl(S)], [roundPct(growthOf(S)), dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: 'Before you launch a pet product, check the leader',
      copy: {
        primary: `Before launching in a niche, look at who's winning it. ${S.store}: ${S.visits} visits a month, ${roundPct(growthOf(S))} since July, ${int(S.liveAds)} Facebook ads live. AdLibrarySpy shows this for any Shopify store, plus their products. Free, no card.`,
        headline: 'Check a niche before you launch', description: 'Traffic, growth and live ads per store. Free.' },
    }) },

  { id: 'v10', store: 'mellowsleep.com', angle: 'punch', accent: 'lime', tr: 'zoom', thumb: 1.2,
    music: { bpm: 128, root: 49, prog: AM, groove: 'four', arp: [0, 2, 1, 3] },
    build: (S, X) => ({
      scenes: [
        hook(6, { layout: 'stack', wall: 'lib', pre: 'One Shopify store.', num: int(S.liveAds), post: 'Facebook ads live', chip: S.store }),
        end(11, { style: 'inverted', line: 'Spy on any<br>store. <b>Free.</b>', ticks: ['No credit card'], fast: true }),
      ],
      numbers: [[int(S.liveAds), dossierUrl(S)]],
      hookText: `One Shopify store. ${int(S.liveAds)} Facebook ads live.`,
      copy: {
        primary: `${S.store}: ${int(S.liveAds)} Facebook ads live today. Look up any store's ads, traffic and products on AdLibrarySpy. Free, no card.`,
        headline: `${int(S.liveAds)} ads. One store.`, description: 'Free ad spy tool. No card.' },
    }) },

  { id: 'v11', store: 'resilia.shop', angle: 'punch', accent: 'cyan', tr: 'up', thumb: 1.2,
    music: { bpm: 120, root: 61.74, prog: LIFT, groove: 'four', arp: [3, 2, 1, 0] },
    build: (S, X) => ({
      scenes: [
        hook(6, { layout: 'center', wall: S.ownAds >= 6 ? 'own' : 'lib', pre: 'This store gets', num: S.visits, post: 'visits a month', src: S.visitsSource, chip: S.store }),
        panelLiveAds(3, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> ads live`), false),
        end(9, { style: 'lockup', line: 'See it for<br><b>any store</b>', ticks: ['Free, no card'], fast: true }),
      ],
      numbers: [[S.visits, dossierUrl(S)], [int(S.liveAds), dossierUrl(S)]],
      hookText: `This store gets ${S.visits} visits a month`,
      copy: {
        primary: `${S.store}: ${S.visits} visits a month and ${int(S.liveAds)} Facebook ads live. Look up any Shopify store on AdLibrarySpy. Free, no card.`,
        headline: 'Any store\'s traffic and ads', description: 'Free. Sign up with your email.' },
    }) },

  { id: 'v12', store: 'thefleececompany.com', angle: 'ad-count-climb', accent: 'coral', tr: 'up', thumb: 2.2,
    music: { bpm: 122, root: 55, prog: DARK, groove: 'four', arp: [0, 1, 2, 3] },
    build: (S, X) => {
      const { a, b } = risingAds(S);
      const verb = b.v >= 2 * a.v ? 'doubled' : 'climbed';
      return {
        scenes: [
          stat(6, { hookish: true, kicker: S.store, head: `Their Facebook ad count <b>${verb}</b> in ${days(a, b)} days`, series: S.liveAdsSeries }),
          panelLiveAds(4, S, cap('Live Meta ads', `<b>${int(b.v)}</b> live today`), false),
          panelVisits(4, S, cap('Traffic · SimilarWeb', `<b>${S.visits}</b> visits, <b>${roundPct(growthOf(S))}</b>`)),
          end(12, { style: 'lockup', line: 'See who\'s<br><b>scaling</b><br>right now', ticks: TICKS(X) }),
        ],
        numbers: [[`${int(a.v)} (${a.t})`, dossierUrl(S)], [`${int(b.v)} (${b.t})`, dossierUrl(S)], [S.visits, dossierUrl(S)], [roundPct(growthOf(S)), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `Their Facebook ad count ${verb} in ${days(a, b)} days`,
        copy: {
          primary: `${S.store} went from ${int(a.v)} live Facebook ads on ${a.t} to ${int(b.v)} on ${b.t}. When a store scales ads like that, you see it on AdLibrarySpy: live ad count per day, traffic and products for any Shopify store. Free, no card.`,
          headline: 'See who\'s scaling their ads', description: 'Daily live-ad counts per store. Free.' },
      };
    } },

  { id: 'v13', store: 'lymphoria.co', angle: 'growth', accent: 'pink', tr: 'zoom', thumb: 1.5,
    music: { bpm: 126, root: 43.65, prog: LIFT, groove: 'four', arp: [0, 1, 2, 1] },
    build: (S, X) => ({
      scenes: [
        hook(5, { layout: 'center', wall: 'lib', pre: 'This health store\'s traffic went', num: roundPct(growthOf(S)), post: 'in one month', src: 'SimilarWeb · Jul → Aug 2026', chip: S.store }),
        panelRow(4, S, cap('Shop search', `<b>${S.row.traffic}</b> visits, <b>${pct(S.row.growth)}</b>`), 'rowGrowth'),
        panelLiveAds(4, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> ads live`), false),
        end(12, { style: 'split', line: 'Catch the<br><b>next one</b>', ticks: TICKS(X) }),
      ],
      numbers: [[roundPct(growthOf(S)), dossierUrl(S)], [S.row.traffic, shopsUrl(S)], [pct(S.row.growth), shopsUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `This health store's traffic went ${roundPct(growthOf(S))} in one month`,
      copy: {
        primary: `${S.store} grew ${pct(S.row.growth)} in visits from July to August (SimilarWeb), to ${S.row.traffic} a month, and has ${int(S.liveAds)} Facebook ads live. On AdLibrarySpy you can filter stores by growth and see their ads. Free, no card.`,
        headline: 'Spot stores while they\'re growing', description: 'Filter Shopify stores by growth. Free.' },
    }) },

  { id: 'v14', store: null, angle: 'top-advertiser', accent: 'amber', tr: 'whip', thumb: 1.5,
    music: { bpm: 118, root: 73.42, prog: DARK, groove: 'four', arp: [0, 2, 1, 3] },
    build: (S, X) => {
      const a = X.advertiser, name = a[0], ads = a.find(s => /^[\d,]{4,}$/.test(s));
      if (!ads || Number(ads.replace(/,/g, '')) < 5000) throw new Error(`advertiser: no strong live-ad count in ${a.slice(0, 6)}`);
      return {
        scenes: [
          hook(5, { layout: 'left', wall: 'lib', kicker: 'Most ads right now', pre: 'One brand is running', num: ads, post: 'Facebook ads', chip: name }),
          panelImg(5, 'advertiser.png', cap('Advertisers', 'Sort every advertiser by <b>live ads</b>'), [{ cx: .06, cy: .45, z: 3.2 }, { cx: .42, cy: .45, z: 3.2 }]),
          wallScene(3, cap('Ads library', 'Then open <b>their ads</b>')),
          end(12, { style: 'lockup', line: 'See who\'s<br><b>spending</b><br>on Meta', ticks: TICKS(X) }),
        ],
        numbers: [[`${name}: ${ads} live ads`, `${SITE}/advertisers`], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `One brand is running ${ads} Facebook ads`,
        copy: {
          primary: `The advertiser with the most live Facebook ads on AdLibrarySpy right now is ${name}, with ${ads}. You can sort every advertiser by live ads or by ads launched in the last 14 days, then open their creatives. Free, no card.`,
          headline: 'Who runs the most Facebook ads?', description: 'Sort advertisers by live ads. Free.' },
      };
    } },

  { id: 'v15', store: null, angle: 'fastest-growing', accent: 'cyan', tr: 'up', thumb: 1.6,
    music: { bpm: 124, root: 65.41, prog: LIFT, groove: 'four', arp: [0, 1, 2, 3] },
    build: (S, X) => {
      const top = X.risers[0], g = top.find(c => /^\+[\d,.]+%$/.test(c));
      if (!g) throw new Error(`risers: no growth in ${top}`);
      return {
        scenes: [
          hook(5, { layout: 'stack', wall: 'lib', kicker: 'Fastest-growing stores', pre: 'The top store this month grew', num: g, post: 'in visits', src: 'SimilarWeb · Jul → Aug 2026' }),
          panelImg(6, 'risers.png', cap('Trends', 'The <b>fastest-growing</b> stores'), [{ cx: .1, cy: .2, z: 2.3 }, { cx: .9, cy: .75, z: 2.3 }]),
          end(12, { style: 'inverted', line: 'Find the next<br><b>breakout.</b>', ticks: TICKS(X) }),
        ],
        numbers: [[g, `${SITE}/trends`], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `The top store this month grew ${g} in visits`,
        copy: {
          primary: `Every month AdLibrarySpy ranks Shopify stores by how fast their traffic is growing (SimilarWeb, month over month). This month's #1 grew ${g}. Open any of them to see their products and Facebook ads. Free, no card.`,
          headline: 'This month\'s fastest-growing stores', description: 'Ranked by measured traffic growth. Free.' },
      };
    } },

  { id: 'v16', store: 'jwpei.com', angle: 'live-ad-count', accent: 'pink', tr: 'zoom', thumb: 1.7,
    music: { bpm: 110, root: 49, prog: POP, groove: 'half', arp: [0, 2, 1, 3] },
    build: (S, X) => {
      const { a, b } = risingAds(S);
      return {
        scenes: [
          hook(5, { layout: 'outline', wall: 'lib', pre: 'A handbag brand running', num: int(S.liveAds), post: 'Facebook ads', chip: S.store }),
          panelProducts(4, cap('Products', 'Their <b>bags</b>, straight from the store')),
          stat(4, { kicker: 'Live Meta ads', head: `Up from <b>${int(a.v)}</b> on ${a.t}`, series: S.liveAdsSeries }),
          end(12, { style: 'lockup', line: 'See any brand\'s<br><b>ads</b>. Free.', ticks: TICKS(X) }),
        ],
        numbers: [[int(S.liveAds), dossierUrl(S)], [`${int(a.v)} (${a.t})`, dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
        hookText: `A handbag brand running ${int(S.liveAds)} Facebook ads`,
        copy: {
          primary: `${S.storeName.replace(/ Official Site$/, '')} (${S.store}) has ${int(S.liveAds)} Facebook ads live, up from ${int(a.v)} on ${a.t}. AdLibrarySpy shows a store's live ad count day by day, next to its traffic and products. Free, no card.`,
          headline: 'How many ads is your niche running?', description: 'Live Meta ad counts per store. Free.' },
      };
    } },

  { id: 'v17', store: null, angle: 'free-checklist', accent: 'violet', tr: 'whip', thumb: 3.4,
    music: { bpm: 104, root: 61.74, prog: AM, groove: 'half', arp: [0, 1, 2, 1] },
    build: (S, X) => {
      const has = (row, s) => { if (!row.join(' ').includes(s)) throw new Error(`vs row lacks "${s}": ${row}`); return s; };
      return {
        scenes: [
          { kind: 'check', beats: 10, title: 'What you get for <b>$0</b>', items: [
            { label: 'Shop explorer', value: `${compact(X.shopsIndexed)}`, note: 'stores indexed' },
            { label: 'Shop lookups', value: 'No cap', note: `TrendTrack Starter: ${has(X.vs.lookups, '5 a week')}` },
            { label: 'Brands tracked', value: 'No cap', note: `TrendTrack Starter: ${has(X.vs.brands, '2 brands')}` },
            { label: 'Team seats', value: 'Free', note: `TrendTrack: ${has(X.vs.seats, '$29 per seat')} after 3` } ] },
          panelImg(4, 'vs_price.png', cap('Honest comparison', 'Price, <b>side by side</b>'), [{ cx: .3, cy: .6, z: 2.3 }, { cx: .85, cy: .6, z: 2.3 }]),
          end(12, { style: 'split', line: 'Stop paying<br>for <b>spy tools</b>', ticks: ['No credit card', 'No plans or credits'] }),
        ],
        numbers: [[compact(X.shopsIndexed), `${SITE}/shops`], ['TrendTrack Starter: 5 lookups a week', `${SITE}/vs/trendtrack`], ['TrendTrack Starter: 2 brands', `${SITE}/vs/trendtrack`], ['TrendTrack: $29 per seat', `${SITE}/vs/trendtrack`]],
        hookText: 'What you get for $0',
        copy: {
          primary: `What AdLibrarySpy costs: nothing. ${compact(X.shopsIndexed)} stores to explore, no cap on lookups or tracked brands, and your team joins free. TrendTrack's Starter plan allows 5 lookups a week and 2 brands (their pricing page). No card to sign up.`,
          headline: 'No lookup caps. No brand caps. $0.', description: 'The free TrendTrack alternative.' },
      };
    } },

  { id: 'v18', store: 'comfrt.com', angle: 'search-lookup', accent: 'lime', tr: 'up', thumb: 2.4,
    music: { bpm: 100, root: 55, prog: POP, groove: 'half', arp: [0, 1, 2, 3] },
    build: (S, X) => ({
      scenes: [
        { kind: 'search', beats: 6, title: 'Look up <b>any</b> Shopify store', query: S.store, name: S.storeName,
          stats: [[S.visits, 'visits / month'], [int(S.liveAds), 'live FB ads'], [growthOf(S), 'growth']] },
        panelRow(3, S, cap('Shop search', 'Every store, <b>one row</b>')),
        panelLiveAds(4, S, cap('Live Meta ads', 'Their ad count, <b>every day</b>')),
        panelProducts(3, cap('Best sellers', 'What\'s <b>selling</b>')),
        end(12, { style: 'lockup', line: 'Try it on<br><b>your</b><br>competitor', ticks: TICKS(X) }),
      ],
      numbers: [[S.visits, dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [growthOf(S), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `Look up any Shopify store (${S.store}: ${S.visits} visits, ${int(S.liveAds)} live ads)`,
      copy: {
        primary: `Type a store's domain into AdLibrarySpy and you get its SimilarWeb traffic, its live Facebook ads and its best sellers. ${S.store}: ${S.visits} visits a month, ${int(S.liveAds)} ads live. Try it on your competitor. Free, no card.`,
        headline: 'Type a domain. See its ads.', description: 'Traffic, live ads, best sellers. Free.' },
    }) },

  { id: 'v19', store: 'tryrovina.com', angle: 'traffic-growth', accent: 'mint', tr: 'zoom', thumb: 2.4,
    music: { bpm: 114, root: 73.42, prog: LIFT, groove: 'four', arp: [0, 2, 1, 3] },
    build: (S, X) => ({
      scenes: [
        { kind: 'tally', beats: 7, title: `${S.store}, this month`, lead: true, items: [
          { label: 'visits a month', value: S.visits, note: 'SimilarWeb' },
          { label: 'since July', value: roundPct(growthOf(S)), note: 'SimilarWeb' },
          { label: 'Facebook ads live', value: int(S.liveAds), note: 'Meta Ad Library' } ] },
        panelVisits(4, S, cap('Traffic · SimilarWeb', `<b>${S.visits}</b>, <b>${growthOf(S)}</b>`)),
        panelLiveAds(4, S, cap('Live Meta ads', `<b>${int(S.liveAds)}</b> and counting`), false),
        end(11, { style: 'inverted', line: 'Find stores<br>on the <b>way up</b>', ticks: TICKS(X) }),
      ],
      numbers: [[S.visits, dossierUrl(S)], [roundPct(growthOf(S)), dossierUrl(S)], [growthOf(S), dossierUrl(S)], [int(S.liveAds), dossierUrl(S)], [compact(X.shopsIndexed), `${SITE}/shops`]],
      hookText: `${S.store}, this month: ${S.visits} visits, ${roundPct(growthOf(S))}, ${int(S.liveAds)} ads`,
      copy: {
        primary: `${S.store}: ${S.visits} visits a month, ${roundPct(growthOf(S))} since July (SimilarWeb), ${int(S.liveAds)} Facebook ads live. AdLibrarySpy puts those three numbers side by side for any Shopify store you look up. Free, sign up with your email.`,
        headline: 'Traffic, growth and ads in one place', description: 'For any Shopify store. Free, no card.' },
    }) },

  { id: 'v20', store: 'gymshark.com', angle: 'punch', accent: 'coral', tr: 'whip', thumb: 1.3,
    music: { bpm: 120, root: 43.65, prog: DARK, groove: 'four', arp: [3, 2, 1, 0] },
    build: (S, X) => ({
      scenes: [
        hook(6, { layout: 'left', wall: 'lib', kicker: 'Monthly visits', pre: `${S.storeName.replace(/ Official Store$/, '')} gets`, num: S.visits, post: 'visits a month', src: S.visitsSource, chip: S.store }),
        wallScene(3, cap('Ads library', 'See the ads <b>behind any store</b>')),
        end(11, { style: 'split', line: 'Spy like the<br><b>big brands.</b>', ticks: ['Free, no card'], fast: true }),
      ],
      numbers: [[S.visits, dossierUrl(S)]],
      hookText: `Gymshark gets ${S.visits} visits a month`,
      copy: {
        primary: `Gymshark's store gets ${S.visits} visits a month (SimilarWeb). AdLibrarySpy shows you that, and the Facebook ads, for any Shopify store. Free, no card.`,
        headline: 'See any store\'s traffic', description: 'SimilarWeb visits + Meta ads. Free.' },
    }) },
];

// ------------------------------------------------------ homepage product tour ---
// The looping, silent 16:9 video in the homepage hero (public/landing). Same
// engine, landscape format, no music and no end card: the page has its own CTA,
// and the last scene hands back to the first so the loop has no seam. `web`
// names the files it writes and the byte budget of each source.
export const HOME = [
  { id: 'tour', store: 'comfrt.com', angle: 'product-tour', format: 'landscape', loop: true, accent: 'lime', tr: 'up',
    music: { bpm: 120 }, poster: 1.4,
    web: { name: 'tour-20260927', sizes: [
      { suffix: '', w: 1600, h: 900, mp4: 2_450_000, webm: 1_900_000 },
      { suffix: '-m', w: 960, h: 540, mp4: 1_150_000, webm: 900_000 } ] },
    build: (S, X) => {
      const { a, b } = risingAds(S);
      const tr = S.trafficSeries, t0 = tr[0], t1 = tr.at(-1);
      if (!(tr.length >= 2 && t1.v > t0.v)) throw new Error(`${S.store}: traffic is not rising (${t0?.v} -> ${t1?.v})`);
      const bt = X.tracker.find(r => r[0] === S.storeName) || X.tracker[0];
      if (!(S.bestSellers && S.products?.[0]?.rank === 1)) throw new Error(`${S.store}: products are not a ranked best-seller list`);
      const month = s => s.replace(/ \d{4}$/, '');
      return {
        scenes: [
          hook(5, { layout: 'words', wall: 'lib', words: 'Spy on <b>any</b><br>Shopify store', sub: 'Live Meta ads · SimilarWeb traffic · best sellers' }),
          wallScene(4, cap('Ads library', 'Browse <b>live</b> Facebook ads')),
          { ...panelRow(5, S, cap('Shop search', 'Find the store <b>behind the ads</b>')), cam: [{ cx: .1, cy: .5, z: 1.7 }, { cx: .85, cy: .5, z: 1.7 }] },
          { ...panelTraffic(5, cap('Traffic · SimilarWeb', `<b>${compact(t0.v)} → ${compact(t1.v)}</b> visits a month`)), cam: [{ cx: .5, cy: .35, z: 1.25 }, { cx: .5, cy: .4, z: 1.0 }] },
          { ...panelProducts(5, cap('Best sellers', 'Their <b>best sellers</b>, ranked')), cam: [{ cx: .5, cy: 0, z: 1.0 }, { cx: .5, cy: .3, z: 1.0 }] },
          stat(5, { kicker: 'Live Meta ads', head: `<b>${compact(a.v)} → ${compact(b.v)}</b> ads in ${days(a, b)} days`, series: S.liveAdsSeries }),
          { kind: 'panel', beats: 5, kicker: 'Brandtracker', head: 'Track <b>every competitor</b>, daily', imgs: [{ src: 'brandtracker.png', from: '_shared', id: 'bt' }],
            cam: [{ cx: .5, cy: .5, z: 1.0 }, { cx: 0, cy: 0, z: 1.2 }], rings: [{ img: 'bt', r: X.rings.tracker, at: .45 }] },
          hook(5, { layout: 'words', wall: 'lib', words: `<b>${compact(X.shopsIndexed)}</b> stores.<br><b>100%</b> free.`, sub: 'adlibraryspy.com' }),
        ],
        numbers: [
          [`${S.store} in the shops explorer: ${S.row.traffic} visits, ${S.row.ads} live ads`, shopsUrl(S)],
          [`${compact(t0.v)} (${month(t0.t)}) → ${compact(t1.v)} (${month(t1.t)}) monthly visits, SimilarWeb`, dossierUrl(S)],
          [`best sellers #1-#6: ${S.products.slice(0, 6).map(p => p.price).join(', ')}`, dossierUrl(S)],
          [`${int(a.v)} (${a.t}) → ${int(b.v)} (${b.t}) live Meta ads`, dossierUrl(S)],
          [`Brandtracker: ${bt[0]} ${bt[1]} visits, ${bt[2]} live ads`, `${SITE}/brandtracker`],
          [`${compact(X.shopsIndexed)} stores indexed`, `${SITE}/shops`],
        ],
      };
    } },
];

// --------------------------------------------------------------- markup ---
const words = html => {                                   // one span per word; <b>…</b> = accent
  let on = false;
  return html.split(/(<br>| )/).filter(t => t && t !== ' ').map(tok => {
    if (tok === '<br>') return '<br>';
    if (tok.startsWith('<b>')) on = true;
    const span = `<span class="w${on ? ' acc' : ''}">${tok.replace(/<\/?b>/g, '')}</span>`;
    if (tok.includes('</b>')) on = false;
    return span;
  }).join(' ').replace(/ <br> /g, '<br>');
};
const caption = s => s.head ? `<div class="cap"><div class="kick">${s.kicker}</div><div class="head">${words(s.head)}</div></div>` : '';
const TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

function sparkSvg(series) {
  const w = 900, h = 400, px = 40, py = 40;
  const vs = series.map(p => p.v), lo = 0, hi = Math.max(...vs) * 1.12;
  const X = i => px + (w - 2 * px) * (series.length === 1 ? .5 : i / (series.length - 1));
  const Y = v => h - py - (h - 2 * py) * (v - lo) / (hi - lo);
  const pts = series.map((p, i) => [X(i), Y(p.v)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${pts.at(-1)[0].toFixed(1)},${h - py}L${pts[0][0].toFixed(1)},${h - py}Z`;
  return { w, h, line, area, pts };
}

function sceneHtml(s, i, S) {
  const id = `s${i}`;
  switch (s.kind) {
    case 'hook': {
      if (s.layout === 'words') return `<div class="sc hook L-words" id="${id}"><div class="big">${words(s.words)}</div>${s.sub ? `<div class="sub key">${s.sub}</div>` : ''}</div>`;
      return `<div class="sc hook L-${s.layout}" id="${id}">
        ${s.kicker ? `<div class="kick key">${s.kicker}</div>` : ''}
        <div class="pre key">${s.pre}</div>
        <div class="numwrap"><div class="num fit key">${s.num}</div>${s.layout === 'outline' ? `<div class="num fill fit">${s.num}</div>` : ''}</div>
        <div class="post key">${s.post}</div>
        ${s.src ? `<div class="src">${s.src}</div>` : ''}
        ${s.chip ? `<div class="chip key"><i></i>${s.chip}</div>` : ''}</div>`;
    }
    case 'panel': case 'wall':
      return `<div class="sc ${s.kind}" id="${id}">${caption(s)}${s.kind === 'panel' ? `<div class="pnl"><div class="sheet"${s.sheetW ? ` style="width:${s.sheetW}px;padding-bottom:${s.pad}px"` : ''}>${s.imgs.map(im => `<img src="${im.from ? `../cap/${im.from}` : `../cap/${S.store}`}/${im.src}"${im.id ? ` data-id="${im.id}"` : ''}${im.inset ? ` class="inset" style="margin:0 ${s.pad}px"` : ''}>`).join('')}</div></div>` : ''}</div>`;
    case 'stat': {
      if (s.series) {
        const g = sparkSvg(s.series), a = s.series[0], b = s.series.at(-1);
        return `<div class="sc stat${s.hookish ? ' hookish' : ''}" id="${id}">${s.hookish ? `<div class="cap"><div class="kick">${s.kicker}</div><div class="head big">${words(s.head)}</div></div>` : caption(s)}
          <div class="chart"><svg viewBox="0 0 ${g.w} ${g.h}" width="${g.w}" height="${g.h}"><defs><linearGradient id="ga${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".45"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
          <path class="area" d="${g.area}" fill="url(#ga${i})"/><path class="line" d="${g.line}" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          ${g.pts.map(([x, y], k) => `<circle class="dot" data-k="${k}" cx="${x}" cy="${y}" r="13"/>`).join('')}</svg>
          <div class="lbl l0 key" style="left:${g.pts[0][0]}px;top:${g.pts[0][1]}px"><b>${int(a.v)}</b><span>${short(a.t)}</span></div>
          <div class="lbl l1 key" style="left:${g.pts.at(-1)[0]}px;top:${g.pts.at(-1)[1]}px"><b>${int(b.v)}</b><span>${short(b.t)}</span></div></div>
          <div class="src">Live Meta ads per day · Meta Ad Library</div></div>`;
      }
      return `<div class="sc stat solo" id="${id}">${caption(s)}<div class="bignum fit key">${s.big}</div><div class="src">${s.sub}</div></div>`;
    }
    case 'product':
      return `<div class="sc product" id="${id}">${caption(s)}<div class="pcard"><img src="../cap/${S.store}/product_1.png"></div>
        <div class="pmeta key"><div class="ptitle">${s.title}</div><div class="pprice">${s.price}</div></div>${s.chip ? `<div class="chip key"><i></i>${s.chip}</div>` : ''}</div>`;
    case 'chat':
      return `<div class="sc chat" id="${id}"><div class="pov key">${words(s.pov)}</div><div class="thread">${s.msgs.map(m =>
        `<div class="msg ${m.me ? 'me' : 'them'}">${m.me ? '' : `<div class="who"><span class="mark">${TARGET}</span>AdLibrarySpy</div>`}<div class="bub key">${m.html}</div></div>`).join('')}</div></div>`;
    case 'search':
      return `<div class="sc search" id="${id}"><div class="ttl key">${words(s.title)}</div>
        <div class="bar key">${SEARCH}<span class="typed" data-q="${s.query}"></span><span class="caret"></span></div>
        <div class="res"><div class="rname">${s.name}<small>${s.query}</small></div><div class="stats">${s.stats.map(([v, l]) => `<div class="st key"><b>${v}</b><span>${l}</span></div>`).join('')}</div></div></div>`;
    case 'check':
      return `<div class="sc check" id="${id}"><div class="ttl key">${words(s.title)}</div>${s.chip ? `<div class="chip key"><i></i>${s.chip}</div>` : ''}<div class="items">${s.items.map(it =>
        `<div class="it key"><span class="box">${CHECK}</span><span class="lab">${it.label}<small>${it.note}</small></span><span class="val">${it.value}</span></div>`).join('')}</div></div>`;
    case 'tally':
      return `<div class="sc tally" id="${id}"><div class="ttl key">${s.title}</div><div class="items">${s.items.map(it =>
        `<div class="it key"><div class="val fit">${it.value}${it.unit ? ` <span class="unit">${it.unit}</span>` : ''}</div><div class="lab">${it.label}${it.note ? ` · <small>${it.note}</small>` : ''}</div></div>`).join('')}</div></div>`;
    case 'price':
      return `<div class="sc price" id="${id}"><div class="cap"><div class="kick">The price of spying</div><div class="head">${words('What ad spy tools <b>cost</b>')}</div></div>
        <div class="card theirs key"><div class="nm">TrendTrack</div><div class="rows">${s.rows.map(([n, p]) => `<div class="pr"><span>${n}</span><b>${p}</b><em>/mo</em></div>`).join('')}</div><div class="strike"></div></div>
        <div class="card ours key"><div class="nm"><span class="mark">${TARGET}</span>AdLibrarySpy</div><div class="zero">$0</div><div class="note">Free. No card, no plans, no credits.</div></div>
        <div class="src">TrendTrack monthly billing, from its pricing page as checked ${s.checked}</div></div>`;
    case 'end':
      return `<div class="sc end E-${s.style}" id="${id}"><div class="lock key"><span class="mark">${TARGET}</span>AdLibrarySpy</div>
        <div class="h key">${s.line.replace(/<b>/g, '<span class="acc">').replace(/<\/b>/g, '</span>')}</div>
        <div class="ticks">${s.ticks.map(t => `<div class="tick key"><span>${CHECK}</span>${t}</div>`).join('')}</div>
        <div class="cta key"><div class="sheen"></div>${s.cta || 'Sign up free'}${ARROW}</div><div class="url">adlibraryspy.com</div></div>`;
  }
  throw new Error(`unknown scene ${s.kind}`);
}

// ------------------------------------------------------------------- page ---
function page(v, S, X, scenes, wall) {
  const acc = ACCENT[v.accent];
  const G = GEO[v.format || 'portrait'], { W, H } = G, land = v.format === 'landscape';
  const cfg = { scenes: scenes.map(s => ({ kind: s.kind, a: s.a, b: s.b, layout: s.layout, wall: s.wall || (s.kind === 'wall' ? 'hero' : null), cam: s.cam, hFromZ: s.hFromZ, rings: s.rings, fast: s.fast })),
    wall, tr: v.tr, W, H, SAFE: G.SAFE, PANEL: G.PANEL, COLS: G.cols, land, loop: !!v.loop, dur: scenes.at(-1).b, end: scenes.at(-1).a };
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,500;0,600;0,700;0,800;0,900;1,800;1,900&display=block" rel="stylesheet">
<style>
:root{--acc:${acc};--lime:${LIME};--ink:${INK}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${INK};font-family:Inter,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
#stage{position:absolute;inset:0;overflow:hidden;background:${INK}}
.glow{position:absolute;left:50%;width:1400px;height:1400px;margin-left:-700px;border-radius:50%;background:radial-gradient(closest-side,${acc}3a,transparent);filter:blur(40px)}
#grid{position:absolute;inset:0;background-image:linear-gradient(${acc}10 2px,transparent 2px),linear-gradient(90deg,${acc}10 2px,transparent 2px);background-size:90px 90px;opacity:.5}
#wall{position:absolute;left:50%;top:50%;width:${G.cols * 356}px;height:2600px;margin:-1300px 0 0 -${G.cols * 178}px;display:flex;gap:26px;justify-content:center}
#wall .col{width:330px;display:flex;flex-direction:column;gap:26px}
#wall img{width:330px;border-radius:22px;display:block;box-shadow:0 20px 50px rgba(0,0,0,.45)}
#shade{position:absolute;inset:0}
.sc{position:absolute;inset:0;visibility:hidden}
.acc{color:var(--acc)}
.w{display:inline-block}
.cap{position:absolute;left:60px;right:60px;top:300px;text-align:center}
.kick{display:inline-block;font-size:30px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${INK};background:var(--acc);padding:9px 20px 8px;border-radius:999px}
.head{margin-top:22px;font-size:80px;line-height:1.02;font-weight:900;letter-spacing:-.035em;text-wrap:balance}
.head.big{font-size:88px}
.head,.hook .pre,.hook .post,.L-words .big{text-shadow:0 4px 28px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.6)}
.src{font-size:28px;font-weight:600;color:rgba(255,255,255,.62);letter-spacing:.01em}
.chip{display:inline-flex;align-items:center;gap:14px;font-size:40px;font-weight:700;padding:14px 30px;border-radius:999px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.25);backdrop-filter:blur(8px)}
.chip i{width:16px;height:16px;border-radius:50%;background:#22c55e;box-shadow:0 0 16px #22c55e}
.mark{display:inline-grid;place-items:center;background:var(--lime);color:#071004}
.mark svg{width:63%;height:63%}
/* hook layouts */
.hook .blk{position:absolute;left:0;right:0}
.hook>*{position:relative}
.hook{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 60px 380px}
.hook .kick{margin-bottom:28px}
.hook .pre{font-size:62px;font-weight:800;letter-spacing:-.03em;line-height:1.08;max-width:960px}
.hook .numwrap{position:relative;margin:6px 0 40px}
.hook .num{font-size:300px;line-height:.95;font-weight:900;letter-spacing:-.06em;color:var(--acc);text-shadow:0 0 80px ${acc}88;white-space:nowrap}
.hook .post{font-size:76px;font-weight:900;letter-spacing:-.035em;line-height:1.05;max-width:960px}
.hook .src{margin-top:22px}
.hook .chip{margin-top:34px}
.L-left{align-items:flex-start;text-align:left;padding:0 72px 380px}
.L-left .pre{font-size:66px}.L-left .post{font-size:84px}
.L-left .num{font-style:italic;font-size:290px}
.L-outline .num{color:transparent;-webkit-text-stroke:6px var(--acc);text-shadow:none}
.L-outline .num.fill{position:absolute;left:0;top:0;right:0;color:var(--acc);-webkit-text-stroke:0;text-shadow:0 0 80px ${acc}88}
.L-stack .numwrap{background:var(--acc);border-radius:36px;padding:10px 44px 22px;transform-origin:50% 50%}
.L-stack .num{color:${INK};text-shadow:none;font-size:250px}
.L-stack .pre{text-transform:uppercase;font-size:50px;letter-spacing:.02em}
.L-stack .post{text-transform:uppercase;font-size:64px;letter-spacing:0}
.L-words .big{font-size:132px;line-height:.98;font-weight:900;letter-spacing:-.05em;text-transform:uppercase;font-style:italic;max-width:980px}
.L-words .sub{margin-top:44px;font-size:48px;font-weight:700;color:rgba(255,255,255,.85);max-width:900px}
/* panels */
.pnl{position:absolute;left:50%;overflow:hidden;border-radius:34px;background:#f5f6fa;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 50px 120px -30px ${acc}66,0 30px 80px rgba(0,0,0,.6)}
.sheet{position:absolute;left:0;top:0;transform-origin:0 0;background:#f5f6fa}
.sheet img{display:block}
.ring{position:absolute;border:7px solid var(--acc);border-radius:20px;box-shadow:0 0 0 4px ${INK}33,0 0 40px var(--acc)}
/* stat */
.stat .chart{position:absolute;left:90px;top:640px;width:900px;height:400px}
.stat.hookish .chart{top:720px}
.stat .line{stroke-dasharray:4000;stroke-dashoffset:4000}
.stat .dot{fill:${INK};stroke:var(--acc);stroke-width:7}
.stat .lbl{position:absolute;transform:translate(-50%,-100%);margin-top:-30px;text-align:center;white-space:nowrap}
.stat .lbl b{display:block;font-size:64px;font-weight:900;letter-spacing:-.03em;line-height:1}
.stat .lbl span{display:block;font-size:28px;font-weight:600;color:rgba(255,255,255,.65);margin-top:6px}
.stat .l1 b{color:var(--acc)}
.stat .l0{transform:translate(-20%,-100%)}.stat .l1{transform:translate(-80%,-100%)}
.stat>.src{position:absolute;left:0;right:0;top:1080px;text-align:center}
.stat.hookish>.src{top:1160px}
.stat.solo .bignum{position:absolute;left:40px;right:40px;top:640px;text-align:center;font-size:300px;font-weight:900;letter-spacing:-.06em;color:var(--acc);text-shadow:0 0 80px ${acc}88;white-space:nowrap;line-height:1}
.stat.solo>.src{top:980px}
/* product */
.product .pcard{position:absolute;left:50%;top:560px;width:500px;height:500px;margin-left:-250px;border-radius:36px;overflow:hidden;background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 50px 120px -30px ${acc}88}
.product .pcard img{width:100%;height:100%;object-fit:cover;display:block}
.product .pmeta{position:absolute;left:60px;right:60px;top:1078px;display:flex;align-items:baseline;justify-content:center;gap:26px}
.product .ptitle{font-size:44px;font-weight:700;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:640px}
.product .pprice{font-size:72px;font-weight:900;color:var(--acc);letter-spacing:-.03em}
.product .chip{position:absolute;left:50%;top:1164px;font-size:34px;padding:10px 24px;transform:translateX(-50%)}
/* chat */
.chat .pov{position:absolute;left:70px;right:70px;top:300px;font-size:70px;font-weight:900;letter-spacing:-.035em;line-height:1.04}
.chat .thread{position:absolute;left:60px;right:60px;top:530px;display:flex;flex-direction:column;gap:20px}
.chat .msg{display:flex;flex-direction:column}
.chat .msg.me{align-items:flex-end}.chat .msg.them{align-items:flex-start}
.chat .who{display:flex;align-items:center;gap:10px;font-size:26px;font-weight:700;color:rgba(255,255,255,.6);margin:0 0 8px 8px}
.chat .who .mark{width:34px;height:34px;border-radius:10px}
.chat .bub{max-width:840px;font-size:44px;font-weight:600;line-height:1.18;padding:20px 32px;border-radius:44px}
.chat .me .bub{background:var(--acc);color:${INK};border-bottom-right-radius:12px}
.chat .them .bub{background:#1d2422;border:2px solid rgba(255,255,255,.1);border-bottom-left-radius:12px}
.chat .them .bub b{color:var(--acc);font-size:58px;font-weight:900;letter-spacing:-.03em}
/* search */
.search .ttl{position:absolute;left:60px;right:60px;top:300px;text-align:center;font-size:80px;font-weight:900;letter-spacing:-.035em;line-height:1.02}
.search .bar{position:absolute;left:70px;right:70px;top:540px;height:128px;border-radius:999px;background:#fff;color:#0b0f0d;display:flex;align-items:center;gap:24px;padding:0 44px;font-size:54px;font-weight:600;box-shadow:0 0 0 6px ${acc}55,0 30px 80px rgba(0,0,0,.5)}
.search .bar svg{width:56px;height:56px;color:#6b7280;flex:none}
.search .caret{width:5px;height:60px;background:#0b0f0d;margin-left:-18px}
.search .res{position:absolute;left:70px;right:70px;top:720px;border-radius:40px;background:#111816;border:2px solid rgba(255,255,255,.12);padding:40px 44px}
.search .rname{font-size:60px;font-weight:900;letter-spacing:-.03em}
.search .rname small{display:block;font-size:32px;font-weight:600;color:rgba(255,255,255,.55);letter-spacing:0;margin-top:4px}
.search .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:34px}
.search .st{background:rgba(255,255,255,.05);border-radius:26px;padding:22px 20px}
.search .st b{display:block;font-size:62px;font-weight:900;color:var(--acc);letter-spacing:-.04em;line-height:1}
.search .st span{display:block;margin-top:10px;font-size:26px;font-weight:600;color:rgba(255,255,255,.7)}
/* checklist + tally */
.check .ttl,.tally .ttl{position:absolute;left:70px;right:70px;top:300px;font-size:74px;font-weight:900;letter-spacing:-.035em;line-height:1.03}
.check .chip{position:absolute;left:70px;top:560px;font-size:34px;padding:10px 24px}
.check .items{position:absolute;left:60px;right:60px;top:660px;display:flex;flex-direction:column;gap:20px}
.check .it{display:flex;align-items:center;gap:26px;padding:22px 30px;border-radius:30px;background:#101715;border:2px solid rgba(255,255,255,.1)}
.check .box{flex:none;width:64px;height:64px;border-radius:18px;border:3px solid var(--acc);color:${INK};display:grid;place-items:center}
.check .box svg{width:40px;height:40px;opacity:0}
.check .lab{flex:1;font-size:42px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.check .lab small{display:block;font-size:26px;font-weight:600;color:rgba(255,255,255,.55);letter-spacing:0;margin-top:4px}
.check .val{font-size:60px;font-weight:900;color:var(--acc);letter-spacing:-.03em;white-space:nowrap}
.tally .ttl{font-size:56px;color:rgba(255,255,255,.8)}
.tally .items{position:absolute;left:70px;right:70px;top:410px;display:flex;flex-direction:column;gap:18px}
.tally .val{font-size:190px;font-weight:900;letter-spacing:-.055em;line-height:.92;color:var(--acc);white-space:nowrap}
.tally .val .unit{font-size:54px;letter-spacing:-.02em;color:#fff}
.tally .lab{font-size:44px;font-weight:700;margin-top:18px}
.tally .lab small{font-size:32px;color:rgba(255,255,255,.55);font-weight:600}
/* price */
.price .card{position:absolute;left:80px;right:80px;border-radius:40px;padding:34px 44px}
.price .theirs{top:540px;background:#141a18;border:2px solid rgba(255,255,255,.12)}
.price .ours{top:880px;background:var(--lime);color:${INK};box-shadow:0 0 120px -20px var(--lime)}
.price .nm{display:flex;align-items:center;gap:16px;font-size:40px;font-weight:800;letter-spacing:-.02em}
.price .ours .mark{width:54px;height:54px;border-radius:16px;background:${INK};color:var(--lime)}
.price .rows{display:flex;gap:18px;margin-top:22px}
.price .pr{flex:1;background:rgba(255,255,255,.06);border-radius:24px;padding:18px 20px}
.price .pr span{display:block;font-size:28px;font-weight:600;color:rgba(255,255,255,.65)}
.price .pr b{font-size:74px;font-weight:900;letter-spacing:-.04em}
.price .pr em{font-style:normal;font-size:30px;font-weight:700;color:rgba(255,255,255,.65)}
.price .strike{position:absolute;left:30px;top:52%;height:12px;border-radius:6px;background:#ff5c5c;box-shadow:0 0 30px #ff5c5c;transform-origin:0 50%;width:calc(100% - 60px);transform:rotate(-4deg) scaleX(0)}
.price .zero{font-size:170px;font-weight:900;letter-spacing:-.06em;line-height:1;margin-top:6px}
.price .note{font-size:34px;font-weight:700}
.price>.src{position:absolute;left:80px;right:80px;top:1262px;text-align:center;font-size:24px}
/* end */
.end{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px 380px}
.end .lock{display:inline-flex;align-items:center;gap:22px;font-size:58px;font-weight:800;letter-spacing:-.03em}
.end .lock .mark{width:92px;height:92px;border-radius:28px}
.end .h{margin-top:44px;font-size:100px;line-height:1;font-weight:900;letter-spacing:-.045em}
.end .ticks{margin-top:44px;display:flex;flex-direction:column;align-items:center;gap:16px}
.end .tick{display:inline-flex;align-items:center;gap:16px;font-size:44px;font-weight:700}
.end .tick span{width:50px;height:50px;border-radius:50%;background:${LIME}22;border:2px solid ${LIME}88;color:${LIME};display:grid;place-items:center}
.end .tick svg{width:28px;height:28px}
.end .cta{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:18px;margin-top:50px;height:132px;padding:0 64px;border-radius:30px;background:var(--lime);color:#071004;font-size:58px;font-weight:900;letter-spacing:-.03em;box-shadow:0 0 90px -10px var(--lime)}
.end .cta svg{width:52px;height:52px}
.E-inverted .sheen{opacity:.35}
.end .sheen{position:absolute;top:0;bottom:0;width:160px;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent)}
.end .url{margin-top:24px;font-size:40px;font-weight:600;color:rgba(255,255,255,.8)}
.E-inverted{color:${INK}}
.E-inverted .acc{color:${INK};background:${INK};color:var(--lime);padding:0 16px;border-radius:18px}
.E-inverted .lock .mark{background:${INK};color:var(--lime)}
.E-inverted .tick span{background:${INK};border-color:${INK};color:var(--lime)}
.E-inverted .cta{background:${INK};color:var(--lime);box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
.E-inverted .url{color:${INK}cc}
.E-split{align-items:flex-start;text-align:left;padding-left:80px}
.E-split .h{font-size:118px;font-style:italic}
.E-split .ticks{align-items:flex-start}
#wipe{position:absolute;left:0;right:0;bottom:0;height:0;background:var(--lime)}
.bug{position:absolute;left:0;right:0;top:1300px;display:flex;justify-content:center;align-items:center;gap:14px;font-size:34px;font-weight:700;letter-spacing:-.02em;color:rgba(255,255,255,.85)}
.bug .mark{width:44px;height:44px;border-radius:13px}
#flash{position:absolute;inset:0;background:var(--acc);opacity:0;pointer-events:none}
${land ? LANDSCAPE_CSS : ''}
</style></head><body><div id="stage">
<div id="grid"></div><div class="glow" id="glow"></div>
<div id="wall"></div><div id="shade"></div><div id="wipe"></div>
${scenes.map((s, i) => sceneHtml(s, i, S)).join('\n')}
<div class="bug" id="bug"><span class="mark">${TARGET}</span>adlibraryspy.com</div>
<div id="flash"></div>
</div>
<script>const C = ${JSON.stringify(cfg)};</script>
<script>${RUNTIME}</script></body></html>`;
}

// Landscape overrides: captions become a left column beside the panel (x 840+),
// the hook and stat scenes re-lay out for a 1920x1080 frame. Type is sized so the
// headline still reads at phone width (1920 -> ~360 CSS px = x0.19).
const LANDSCAPE_CSS = `
.cap{left:110px;right:auto;width:680px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left}
.kick{font-size:34px;transform-origin:0 50%}
.head{font-size:100px;line-height:1;margin-top:30px;text-wrap:balance}
.hook{padding:0 140px}
.L-words .big{font-size:176px;max-width:1640px;line-height:.94}
.L-words .sub{font-size:52px;max-width:1400px;margin-top:48px}
.stat .chart{left:900px;top:330px}
.stat>.src{left:900px;right:auto;width:900px;top:790px;font-size:30px}
.bug{top:auto;bottom:56px;left:110px;right:auto;justify-content:flex-start;font-size:30px}
.bug .mark{width:40px;height:40px;border-radius:12px}
.glow{width:1800px;height:1800px;margin-left:-900px}
`;

// The page runtime: renderAt(t) is a pure function of time.
const RUNTIME = String.raw`
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const eOut = k => 1 - Math.pow(1 - clamp(k), 3);
const eInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eBack = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const prog = (t, a, d) => clamp((t - a) / d);
const hex2 = k => Math.round(clamp(k) * 255).toString(16).padStart(2, '0');
const SC = C.scenes.map((s, i) => Object.assign(s, { el: document.getElementById('s' + i), i }));

// ---- ad wall
const wall = $('#wall'), cols = [];
for (let c = 0; c < C.COLS && C.wall.length; c++) {
  const col = document.createElement('div'); col.className = 'col';
  const list = C.wall.map((_, i) => C.wall[(i + c * 3) % C.wall.length]);
  for (const src of [...list, ...list, ...list]) { const im = document.createElement('img'); im.src = src; col.appendChild(im); }
  wall.appendChild(col); cols.push(col);
}

// ---- fit wide numbers into the frame
// Measures the painted text (a Range), not the element's box, so block-level numbers fit too.
function textW(el) { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect().width; }
function fit(el, max) { let fs = parseFloat(getComputedStyle(el).fontSize); while (textW(el) > max && fs > 40) { fs -= 4; el.style.fontSize = fs + 'px'; } }

// ---- panels: a sheet of real crops seen through a moving camera
const PANEL = C.PANEL;
function setupPanel(s) {
  s.panel = $('.pnl', s.el); s.sheet = $('.sheet', s.el);
  const imgs = $$('img', s.sheet);
  const w = Math.max(...imgs.map(im => im.naturalWidth));
  if (!s.sheet.style.width) s.sheet.style.width = w + 'px';
  const sw = parseFloat(s.sheet.style.width);
  for (const im of imgs) im.style.width = (im.classList.contains('inset') ? sw - 2 * parseFloat(im.style.marginLeft) : sw) + 'px';
  s.sw = s.sheet.offsetWidth; s.sh = s.sheet.offsetHeight;
  s.fit = PANEL.w / s.sw; s.pw = PANEL.w;
  s.ph = s.hFromZ ? Math.min(PANEL.maxH, Math.round(s.sh * s.fit * s.cam[0].z)) : Math.min(PANEL.maxH, Math.round(s.sh * s.fit * Math.max(1, Math.min(s.cam[0].z, s.cam[1].z || 1))));
  s.panel.style.width = s.pw + 'px'; s.panel.style.height = s.ph + 'px';
  if (PANEL.x != null) { s.panel.style.left = PANEL.x + 'px'; s.panel.style.top = (PANEL.top + (PANEL.maxH - s.ph) / 2) + 'px'; }
  else { s.panel.style.marginLeft = -s.pw / 2 + 'px'; s.panel.style.top = (PANEL.top + (PANEL.maxH - s.ph) / 2 * (s.hFromZ ? .75 : 1)) + 'px'; }
  s.ringEls = (s.rings || []).map(r => {
    const im = $('img[data-id="' + r.img + '"]', s.sheet);
    const pad = 18, box = { x: im.offsetLeft + r.r.x * im.offsetWidth - pad, y: im.offsetTop + r.r.y * im.offsetHeight - pad, w: r.r.w * im.offsetWidth + pad * 2, h: r.r.h * im.offsetHeight + pad * 2 };
    const el = document.createElement('div'); el.className = 'ring';
    Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', borderWidth: (7 / s.fit / (s.cam[1].z || 1)) + 'px', borderRadius: (18 / s.fit) + 'px' });
    s.sheet.appendChild(el);
    return { el, box, at: r.at };
  });
}
function camPoint(s, c) {
  if (c.ring == null) return c;
  const b = s.ringEls[c.ring].box;
  return { cx: (b.x + b.w / 2) / s.sw, cy: (b.y + b.h / 2) / s.sh, z: c.z };
}
function place(s, k) {
  const a = camPoint(s, s.cam[0]), b = camPoint(s, s.cam[1]), e = eInOut(k);
  const z = lerp(a.z, b.z, e), sc = s.fit * z;
  const cx = lerp(a.cx, b.cx, e) * s.sw * sc, cy = lerp(a.cy, b.cy, e) * s.sh * sc;
  const Wd = s.sw * sc, Ht = s.sh * sc;
  let x = s.pw / 2 - cx, y = s.ph / 2 - cy;
  x = Wd <= s.pw ? (s.pw - Wd) / 2 : clamp(x, s.pw - Wd, 0);
  y = Ht <= s.ph ? (s.ph - Ht) / 2 : clamp(y, s.ph - Ht, 0);
  s.sheet.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
}

// ---- scene entrances/exits (one transition style per video)
function enterExit(s, lt, d) {
  const el = s.el, first = s.i === 0 && !C.loop, last = s.kind === 'end';
  const ki = first ? 1 : eBack(prog(lt, 0, .32)), ko = last ? 0 : eOut(prog(lt, d - .16, .16));
  el.style.opacity = first ? 1 - ko : Math.min(prog(lt, 0, .12), 1 - ko);
  if (C.tr === 'whip') { const kx = first ? 1 : eOut(prog(lt, 0, .3)); el.style.transform = 'translateX(' + ((1 - kx) * 700 - ko * 700) + 'px) skewX(' + ((1 - kx) * -6) + 'deg)'; }
  else if (C.tr === 'zoom') { const kz = first ? 1 : eOut(prog(lt, 0, .3)); el.style.transform = 'scale(' + (1.25 - .25 * kz + ko * .15) + ')'; }
  else el.style.transform = 'translateY(' + (70 * (1 - ki) - 60 * ko) + 'px) scale(' + (.92 + .08 * ki) + ')';
}
function words(root, lt, at) {
  $$('.w', root).forEach((w, i) => {
    const p = eBack(prog(lt, at + i * .045, .28));
    w.style.opacity = prog(lt, at + i * .045, .1);
    w.style.transform = 'translateY(' + (50 * (1 - p)) + 'px)';
  });
}
function pop(el, lt, at, dy = 60, s0 = .85) { if (!el) return; const k = eBack(prog(lt, at, .35)); el.style.opacity = prog(lt, at, .1); el.style.transform = 'translateY(' + dy * (1 - k) + 'px) scale(' + (s0 + (1 - s0) * k) + ')'; }
function capAt(root, lt) {
  const cap = $('.cap', root); if (!cap) return;
  const k = $('.kick', cap), ki = eBack(prog(lt, 0, .25));
  if (k) { k.style.transform = 'scale(' + (.6 + .4 * ki) + ')'; k.style.opacity = prog(lt, 0, .08); }
  words(cap, lt, .05);
}

const KIND = {
  hook(s, lt, d) {
    const r = s.el, first = s.i === 0 && !C.loop;
    if (s.layout === 'words') { words(r, lt, first ? -1 : 0); const sub = $('.sub', r); if (sub) pop(sub, lt, .5, 30, .9); return; }
    const num = $('.num', r), p = eBack(prog(lt, 0, .45));
    $('.numwrap', r).style.transform = s.layout === 'stack' ? 'rotate(' + (-2 - 4 * (1 - p)) + 'deg) scale(' + (1.15 - .15 * p) + ')' : 'scale(' + (1.12 - .12 * p) + ') rotate(' + (-4 * (1 - p)) + 'deg)';
    const fill = $('.num.fill', r);
    if (fill) { const f = eInOut(prog(lt, .25, .7)); fill.style.clipPath = 'inset(0 ' + (100 - 100 * f) + '% 0 0)'; }
    const pre = $('.pre', r); pre.style.transform = 'scale(' + (1.08 - .08 * eOut(prog(lt, 0, .4))) + ')';
    const post = $('.post', r), q = eBack(prog(lt, .12, .4)); post.style.transform = 'translateY(' + (40 * (1 - q)) + 'px)';
    const chip = $('.chip', r); if (chip) { const c = eBack(prog(lt, .7, .35)); chip.style.opacity = prog(lt, .7, .1); chip.style.transform = 'scale(' + (.5 + .5 * c) + ')'; }
    const src = $('.src', r); if (src) src.style.opacity = prog(lt, .45, .2);
  },
  panel(s, lt, d) {
    capAt(s.el, lt);
    place(s, prog(lt, .1, d - .25));
    s.ringEls.forEach(r => { const k = eBack(prog(lt, r.at, .3)); r.el.style.opacity = prog(lt, r.at, .08); r.el.style.transform = 'scale(' + (1.35 - .35 * k) + ')'; });
  },
  wall(s, lt) { capAt(s.el, lt); },
  stat(s, lt, d) {
    const r = s.el; if (s.i === 0) words(r, lt, -1); else capAt(r, lt);
    const line = $('.line', r);
    if (line) {
      const k = eInOut(prog(lt, .25, 1.0)), len = line.getTotalLength();
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len * (1 - k);
      $('.area', r).style.opacity = eOut(prog(lt, .6, .6));
      const dots = $$('.dot', r); dots.forEach((c, i) => { const at = .25 + i / Math.max(1, dots.length - 1); c.style.opacity = prog(lt, at, .08); });
      pop($('.l0', r), lt, .25, 30, .8); pop($('.l1', r), lt, 1.2, 30, .8);
      const l0 = $('.l0', r), l1 = $('.l1', r);
      l0.style.transform = 'translate(-20%,-100%) ' + l0.style.transform; l1.style.transform = 'translate(-80%,-100%) ' + l1.style.transform;
    } else { const n = $('.bignum', r), p = eBack(prog(lt, .1, .45)); n.style.transform = 'scale(' + (1.2 - .2 * p) + ')'; n.style.opacity = prog(lt, .1, .1); }
    const src = $('.src', r); if (src) src.style.opacity = prog(lt, .8, .3);
  },
  product(s, lt) {
    const r = s.el; capAt(r, lt);
    const c = $('.pcard', r), k = eBack(prog(lt, .1, .45));
    c.style.transform = 'scale(' + (.7 + .3 * k) + ') rotate(' + (-6 * (1 - k)) + 'deg)'; c.style.opacity = prog(lt, .1, .1);
    pop($('.pmeta', r), lt, .45, 40, .9); const chip = $('.chip', r); if (chip) { const q = eBack(prog(lt, .8, .35)); chip.style.opacity = prog(lt, .8, .1); chip.style.transform = 'translateX(-50%) scale(' + (.5 + .5 * q) + ')'; }
    if (s.i === 0) { $$('.w', r).forEach(w => { w.style.opacity = 1; w.style.transform = 'none'; }); const kk = $('.kick', r); kk.style.opacity = 1; kk.style.transform = 'none'; }
  },
  chat(s, lt, d) {
    const r = s.el; words($('.pov', r), lt, -1);
    const msgs = $$('.msg', r), gap = Math.min(.75, (d - 1.2) / msgs.length);
    msgs.forEach((m, i) => { const at = i ? .3 + i * gap : -1; const k = eBack(prog(lt, at, .3)); m.style.opacity = prog(lt, at, .08); m.style.transform = 'translateY(' + 40 * (1 - k) + 'px) scale(' + (.9 + .1 * k) + ')'; m.style.transformOrigin = m.classList.contains('me') ? '100% 100%' : '0 100%'; });
  },
  search(s, lt, d) {
    const r = s.el; words($('.ttl', r), lt, -1);
    const typed = $('.typed', r), q = typed.dataset.q, n = Math.max(3, Math.round(clamp((lt + .1) / 1.0) * q.length));
    typed.textContent = q.slice(0, n);
    $('.caret', r).style.opacity = (n < q.length || Math.floor(lt * 2.5) % 2 === 0) ? 1 : 0;
    const res = $('.res', r); pop(res, lt, 1.35, 60, .9);
    $$('.st', r).forEach((e, i) => pop(e, lt, 1.6 + i * .18, 30, .8));
  },
  check(s, lt, d) {
    const r = s.el; words($('.ttl', r), lt, s.i === 0 ? -1 : 0);
    const chip = $('.chip', r); if (chip) pop(chip, lt, .3, 20, .8);
    const items = $$('.it', r), gap = Math.min(.45, (d - 1.4) / items.length), first = s.i === 0;
    items.forEach((it, i) => {
      const at = first ? (i ? .2 + i * gap : -.19) : .5 + i * gap, k = eBack(prog(lt, at, .3));
      it.style.opacity = prog(lt, at, .1); it.style.transform = 'translateX(' + (-80 * (1 - k)) + 'px)';
      const box = $('.box', it), c = prog(lt, at + .2, .12);
      box.style.background = c > 0 ? 'var(--acc)' : 'transparent'; $('svg', box).style.opacity = c;
      box.style.transform = 'scale(' + (1 + .25 * Math.sin(Math.PI * c)) + ')';
    });
  },
  tally(s, lt, d) {
    const r = s.el; pop($('.ttl', r), lt, s.i === 0 ? -1 : 0, 20, .95);
    const items = $$('.it', r), gap = Math.min(.7, (d - 1.2) / items.length);
    items.forEach((it, i) => { const at = (s.i === 0 && i === 0) ? -1 : .2 + i * gap; const k = eBack(prog(lt, at, .35)); it.style.opacity = prog(lt, at, .1); it.style.transform = 'translateY(' + 60 * (1 - k) + 'px) scale(' + (.9 + .1 * k) + ')'; });
  },
  price(s, lt, d) {
    const r = s.el; capAt(r, lt);
    pop($('.theirs', r), lt, .15, 60, .9);
    $$('.pr', r).forEach((e, i) => pop(e, lt, .35 + i * .15, 30, .8));
    const st = $('.strike', r), k = eOut(prog(lt, 1.4, .35)); st.style.transform = 'rotate(-4deg) scaleX(' + k + ')';
    $('.theirs', r).style.filter = 'saturate(' + (1 - .8 * k) + ') brightness(' + (1 - .35 * k) + ')';
    pop($('.ours', r), lt, 1.95, 90, .8);
    const z = $('.zero', r), p = eBack(prog(lt, 2.2, .4)); z.style.transform = 'scale(' + (1.4 - .4 * p) + ')'; z.style.transformOrigin = '0 60%';
    const src = $('.src', r); src.style.opacity = prog(lt, 2.4, .3);
  },
  end(s, lt, d) {
    const r = s.el, f = s.fast ? .6 : 1;
    pop($('.lock', r), lt, 0); pop($('.h', r), lt, .18 * f, 80);
    $$('.tick', r).forEach((el, i) => { const k = eBack(prog(lt, (.55 + i * .15) * f, .3)); el.style.opacity = prog(lt, (.55 + i * .15) * f, .1); el.style.transform = 'translateX(' + (-80 * (1 - k)) + 'px)'; });
    const at = 1.05 * f; pop($('.cta', r), lt, at, 90);
    const cta = $('.cta', r);
    if (lt > at + .45) cta.style.transform = 'scale(' + (1 + .035 * Math.max(0, Math.sin((lt - at - .45) * Math.PI * 2))) + ')';
    const sheen = $('.sheen', r), sp = ((lt - at - .55) % 1.6) / .7;
    sheen.style.left = (lt > at + .55 && sp <= 1 ? lerp(-200, cta.offsetWidth + 40, sp) : -400) + 'px';
    pop($('.url', r), lt, at + .2, 30);
  },
};

function setup() {
  for (const s of SC) {
    if (s.kind === 'panel') setupPanel(s);
    $$('.fit', s.el).forEach(el => fit(el, s.kind === 'tally' ? 940 : (s.layout === 'left' ? 936 : 960)));
    const fill = $('.num.fill', s.el); if (fill) fill.style.fontSize = $('.num', s.el).style.fontSize;
  }
}

window.renderAt = t => {
  const cur = SC.find(s => t >= s.a && t < s.b) || SC[SC.length - 1];
  const prev = SC[cur.i - 1];
  const inEnd = cur.kind === 'end', endStyle = inEnd && cur.el.classList.contains('E-inverted');
  // wall: hero behind hooks that ask for it and wall scenes, faint texture elsewhere
  const wmode = s => !s ? 'tex' : (s.wall ? 'hero' : s.kind === 'end' ? 'off' : 'tex');
  const wop = m => m === 'hero' ? 1 : m === 'tex' ? .14 : 0;
  const bl = eOut(prog(t, cur.a, .35));
  wall.style.opacity = lerp(wop(wmode(prev)), wop(wmode(cur)), cur.i === 0 ? 1 : bl);
  wall.style.transform = 'rotate(-9deg) scale(' + (cur.kind === 'wall' ? 1.02 + .06 * prog(t, cur.a, cur.b - cur.a) : 1.12) + ')';
  // Loop: one constant speed per column that scrolls a whole number of lengths per
  // pass, so the last frame meets the first.
  cols.forEach((col, c) => { const half = col.scrollHeight / 3, base = c % 2 ? 150 : 110;
    const speed = C.loop ? Math.max(1, Math.round(base * C.dur / half)) * half / C.dur : base * (cur.kind === 'wall' ? 1.6 : 1);
    col.style.transform = 'translateY(' + (-((t * speed + c * 380) % half)) + 'px)'; });
  const dim = cur.kind === 'wall' ? .4 : .8;
  $('#shade').style.background = C.land && cur.kind !== 'hook'
    ? 'linear-gradient(90deg,#050807f5 0%,#050807' + hex2(Math.max(dim, .9)) + ' 38%,#050807' + hex2(dim) + ' 60%,#050807' + hex2(dim) + ' 100%)'
    : 'linear-gradient(180deg,#050807f2 0%,#050807' + hex2(dim) + ' 34%,#050807' + hex2(dim) + ' 70%,#050807f5 100%)';
  const glow = $('#glow'); glow.style.top = (H0 * (inEnd ? .2 : .12) - 700) + 'px'; glow.style.opacity = inEnd ? .9 : .55;
  $('#grid').style.opacity = cur.wall || cur.kind === 'wall' ? 0 : .5;
  $('#grid').style.transform = 'translateY(' + (-(t * (C.loop ? 90 * Math.max(1, Math.round(30 * C.dur / 90)) / C.dur : 30)) % 90) + 'px)';
  // inverted end card: lime wipes up from the bottom
  $('#wipe').style.height = (endStyle ? H0 * eInOut(prog(t, cur.a, .45)) : 0) + 'px';
  $('#glow').style.visibility = endStyle ? 'hidden' : 'visible';
  // flash on cuts (whip videos)
  $('#flash').style.opacity = C.tr === 'whip' && cur.i > 0 ? .35 * (1 - prog(t, cur.a, .12)) : 0;

  for (const s of SC) {
    const on = s === cur;
    s.el.style.visibility = on ? 'visible' : 'hidden';
    if (!on) continue;
    const lt = t - s.a, d = s.b - s.a;
    enterExit(s, lt, d);
    KIND[s.kind](s, lt, d);
  }
  $('#bug').style.opacity = (cur.i > 0 && !inEnd && cur.kind !== 'chat' && cur.kind !== 'search' && cur.kind !== 'check' && cur.kind !== 'tally' && cur.kind !== 'product' && cur.kind !== 'price') ? .9 * prog(t, cur.a, .3) : 0;
};
const H0 = C.H;
// Key text must sit inside the safe zone once its scene has landed.
window.safeCheck = t => {
  window.renderAt(t);
  const cur = SC.find(s => t >= s.a && t < s.b) || SC[SC.length - 1], bad = [];
  for (const el of $$('.key', cur.el)) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).opacity === '0') continue;
    if (r.top < C.SAFE.top - 2 || r.bottom > C.SAFE.bottom + 2 || r.left < C.SAFE.left - 2 || r.right > C.SAFE.right + 2)
      bad.push(cur.kind + ' ' + el.className + ' "' + el.textContent.trim().slice(0, 30) + '" ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
  }
  return bad;
};
window.ready = (async () => { await document.fonts.ready; await Promise.all([...document.images].map(im => im.decode().catch(() => {}))); setup(); return document.fonts.check('900 80px Inter') && [...document.images].every(im => im.naturalWidth > 0); })();
`;

// ------------------------------------------------------------------ music ---
// Synthesized per video: tempo, key, progression, groove and arpeggio order all
// come from the spec, so no two ads share a track. Kick/clap/hats/bass/arp/pad,
// a whoosh on every cut, a riser into the end card and sub impacts on the hook
// and the CTA — all from ffmpeg aevalsrc.
function music(FFMPEG, file, { bpm, root, prog, groove, arp }, dur, cuts, endAt) {
  const b = 60 / bpm, bar = 4 * b;
  const ci = `floor(mod(t,${(4 * bar).toFixed(4)})/${bar.toFixed(4)})`;
  const sel = (vals, idx) => vals.slice(0, -1).reduceRight((acc, v, i) => `if(eq(${idx},${i}),${v},${acc})`, String(vals.at(-1)));
  const f = semi => root * 2 ** (semi / 12);
  const rootE = sel(prog.map(([s]) => f(s).toFixed(2)), ci);
  const step = groove === 'four' ? b / 4 : b / 2;
  const k = `mod(floor(t/${step.toFixed(5)}),4)`;
  const chordTones = ([s, q]) => [0, q === 'm' ? 3 : 4, 7, 12].map(x => f(s + x + 24).toFixed(2));
  const arpE = sel(prog.map(c => { const tn = chordTones(c); return sel(arp.map(i => tn[i]), k); }), ci);
  const padE = sel(prog.map(([s, q]) => [0, q === 'm' ? 3 : 4, 7].map(x => `sin(2*PI*${f(s + x + 12).toFixed(2)}*t)`).join('+')), ci);
  const brk = `not(between(t,${(endAt - b).toFixed(3)},${(endAt - 0.001).toFixed(3)}))`;
  const live = `lt(t,${(dur - 0.5).toFixed(3)})*${brk}`;
  const kp = groove === 'four' ? b : 2 * b;
  const kick = `${live}*0.9*sin(2*PI*(45*mod(t,${kp.toFixed(5)})+3.2*(1-exp(-30*mod(t,${kp.toFixed(5)})))))*exp(-7*mod(t,${kp.toFixed(5)}))`;
  const bass = groove === 'four'
    ? `${live}*gte(mod(t,${b.toFixed(5)}),${(b / 2).toFixed(5)})*0.32*(sin(2*PI*${rootE}*2*mod(t,${(b / 2).toFixed(5)}))+0.5*sin(2*PI*${rootE}*4*mod(t,${(b / 2).toFixed(5)})))*exp(-6*mod(t,${(b / 2).toFixed(5)}))*(1-exp(-200*mod(t,${(b / 2).toFixed(5)})))`
    : `${live}*0.36*(sin(2*PI*${rootE}*2*mod(t,${b.toFixed(5)}))+0.4*sin(2*PI*${rootE}*4*mod(t,${b.toFixed(5)})))*exp(-2.5*mod(t,${b.toFixed(5)}))*(1-exp(-200*mod(t,${b.toFixed(5)})))`;
  const arpV = `lt(t,${(dur - 0.4).toFixed(3)})*${groove === 'four' ? 0.12 : 0.1}*(sin(2*PI*${arpE}*mod(t,${step.toFixed(5)}))+0.3*sin(4*PI*${arpE}*mod(t,${step.toFixed(5)})))*exp(-${groove === 'four' ? 16 : 9}*mod(t,${step.toFixed(5)}))*(1-exp(-400*mod(t,${step.toFixed(5)})))`;
  const pad = `lt(t,${(dur - 0.3).toFixed(3)})*0.035*(${padE})*(0.75+0.25*sin(2*PI*${(bpm / 60 / 2).toFixed(4)}*t))`;
  const sub = at => `gte(t,${at})*0.8*sin(2*PI*(38*(t-${at})+7.5*(1-exp(-8*(t-${at})))))*exp(-2.2*(t-${at}))`;
  const rs = Math.max(0, endAt - 1.6);
  const riser = `between(t,${rs.toFixed(3)},${endAt.toFixed(3)})*0.07*((t-${rs.toFixed(3)})/1.6)*sin(2*PI*(260*(t-${rs.toFixed(3)})+180*pow(t-${rs.toFixed(3)},2)))`;
  const tonal = [kick, bass, arpV, pad, sub(0), sub(endAt.toFixed(3)), riser].join('+');
  const cut = cuts.map(c => `0.5*exp(-pow((t-${c.toFixed(3)}+0.06)/0.07,2))`).join('+') || '0';
  const clapP = groove === 'four' ? 2 * b : 4 * b, clapO = groove === 'four' ? b : 2 * b;
  const clap = `(2*random(0)-1)*(${live}*0.4*exp(-24*mod(t-${clapO.toFixed(5)},${clapP.toFixed(5)}))*gte(mod(t,${clapP.toFixed(5)}),${clapO.toFixed(5)}) + ${cut} + between(t,${rs.toFixed(3)},${endAt.toFixed(3)})*0.35*pow((t-${rs.toFixed(3)})/1.6,2))`;
  const hp = groove === 'four' ? b : b / 2, ho = groove === 'four' ? b / 2 : b / 4;
  const hat = `(2*random(0)-1)*(${live}*${groove === 'four' ? 0.16 : 0.1}*exp(-45*mod(t-${ho.toFixed(5)},${hp.toFixed(5)}))*gte(mod(t,${hp.toFixed(5)}),${ho.toFixed(5)}) + 0.4*gte(t,${endAt.toFixed(3)})*exp(-3*(t-${endAt.toFixed(3)})) + 0.4*exp(-3*t))`;
  const D = dur.toFixed(3);
  const graph = [
    `aevalsrc=exprs='${tonal}':s=48000:d=${D}[a]`,
    `aevalsrc=exprs='${clap}':s=48000:d=${D},highpass=f=900,lowpass=f=9000[b]`,
    `aevalsrc=exprs='${hat}':s=48000:d=${D},highpass=f=7000[c]`,
    `[a][b][c]amix=inputs=3:normalize=0,aformat=channel_layouts=stereo,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${(dur - 1).toFixed(3)}:d=1,aresample=48000[m]`,
  ].join(';');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-filter_complex', graph, '-map', '[m]', '-t', D, '-c:a', 'pcm_s16le', file], { stdio: ['ignore', 'ignore', 'inherit'] });
}

// ----------------------------------------------------------------- render ---
function load(CAP, store) {
  const f = path.join(CAP, store, 'data.json');
  if (!fs.existsSync(f)) throw new Error(`no capture for ${store} (${f})`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const run = (FFMPEG, args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] }); p.on('close', c => c ? rej(new Error(`ffmpeg exited ${c}`)) : res()); });

async function renderOne(v, { CAP, WORK, OUT, FFMPEG, browser }) {
  const X = load(CAP, '_shared');
  const S = v.store ? load(CAP, v.store) : { store: '_shared' };
  const built = v.build(S, X);
  const beat = 60 / v.music.bpm;
  let t = 0;
  const scenes = built.scenes.map(s => { const a = t; t += s.beats * beat; return { ...s, a, b: t }; });
  const dur = Math.round(t * FPS) / FPS, frames = Math.round(dur * FPS);
  if (v.loop ? dur < 15 || dur > 25 : dur < 7.5 || dur > 20.5) throw new Error(`${v.id}: ${dur.toFixed(1)}s is outside ${v.loop ? '15-25' : '8-20'}s`);
  const G = GEO[v.format || 'portrait'];
  const dir = path.join(WORK, v.id);
  fs.mkdirSync(dir, { recursive: true });
  const rel = f => `../cap/${f}`;
  const wantOwn = scenes.some(s => s.wall === 'own') || (scenes.some(s => s.kind === 'wall') && (S.ownAds || 0) >= 6 && scenes.find(s => s.kind === 'wall').kicker === 'Their ads');
  const wall = wantOwn
    ? [...Array(S.ownAds).keys()].map(i => rel(`${S.store}/ad_${i}.png`))
    : [...Array(X.libAds).keys()].map(i => rel(`_shared/lib_${i}.png`));
  const html = path.join(dir, 'compose.html');
  fs.writeFileSync(html, page(v, S, X, scenes, wall));
  const wav = path.join(dir, 'music.wav');
  if (!v.loop) music(FFMPEG, wav, v.music, dur, scenes.slice(1).map(s => s.a), scenes.at(-1).a);

  const pg = await browser.newPage({ viewport: { width: G.W, height: G.H }, deviceScaleFactor: 1 });
  try {
    await pg.goto('file://' + html);
    if (!(await pg.evaluate(() => window.ready))) throw new Error(`${v.id}: Inter or an image did not load`);
    // Safe-zone assertion at each scene's settled moment.
    for (const s of scenes) {
      const at = s.kind === 'end' ? s.b - 0.1 : s.b - 0.2;   // fully landed, before the exit
      const bad = await pg.evaluate(tt => window.safeCheck(tt), at);
      if (bad.length) throw new Error(`${v.id}: key text outside the safe zone at ${at.toFixed(2)}s:\n  ${bad.join('\n  ')}`);
    }
    // Frames -> near-lossless intermediate, then a two-pass encode sized to fit.
    const mid = path.join(dir, 'frames.mp4');
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(FPS), mid], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error(`ffmpeg exited ${c}`)) : res()));
    // A loop starts on its poster frame (so the poster -> first frame swap is invisible)
    // and wraps: renderAt is periodic, so frame N-1 flows into frame 0.
    const t0 = v.loop ? Math.round(v.poster * FPS) / FPS : 0;
    for (let i = 0; i < frames; i++) {
      await pg.evaluate(tt => window.renderAt(tt), (t0 + i / FPS) % dur);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    if (v.loop) { const out = await encodeWeb(v, { FFMPEG, OUT, dir, mid, dur }); fs.rmSync(mid, { force: true });
      return { id: v.id, store: v.store, angle: v.angle, duration: Number(dur.toFixed(2)), files: out,
        numbers_shown: built.numbers.map(([value, source_page]) => ({ value, source_page })), captured_at: S.capturedAt, shared_captured_at: X.capturedAt }; }
    await pg.evaluate(tt => window.renderAt(tt), v.thumb);
    await pg.screenshot({ type: 'jpeg', quality: 80, path: path.join(OUT, `${v.id}.jpg`) });

    const mp4 = path.join(OUT, `${v.id}.mp4`);
    let kbps = Math.min(3800, Math.floor((8.4e6 * 8 / dur - 128e3) / 1000));
    for (;;) {
      const common = ['-y', '-loglevel', 'error', '-i', mid, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`,
        '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-r', String(FPS), '-passlogfile', path.join(dir, 'x264')];
      await run(FFMPEG, [...common, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
      await run(FFMPEG, [...common, '-pass', '2', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-t', dur.toFixed(3), '-movflags', '+faststart', mp4]);
      const size = fs.statSync(mp4).size;
      if (size <= MAX_BYTES) break;
      kbps = Math.floor(kbps * MAX_BYTES / size * 0.97);
    }
    fs.rmSync(mid, { force: true });
    const size = fs.statSync(mp4).size;
    console.log(`${v.id}  ${v.store || '-'}  ${v.angle}  ${dur.toFixed(1)}s  ${(size / 1e6).toFixed(2)} MB  ${kbps} kbps`);
    return {
      id: v.id, file: `${v.id}.mp4`, thumb: `${v.id}.jpg`, store: v.store || (v.angle === 'top-advertiser' ? X.advertiser[0] : null), angle: v.angle,
      duration: Number(dur.toFixed(2)), bytes: size, hook: built.hookText,
      primary_text: built.copy.primary, headline: built.copy.headline, description: built.copy.description,
      numbers_shown: built.numbers.map(([value, source_page]) => ({ value, source_page })),
      captured_at: (v.store ? S : X).capturedAt,
    };
  } finally { await pg.close(); }
}

// Silent web sources for a loop, each size fitted to its byte budget: H.264 High
// (+faststart) and VP9 (two-pass, constrained quality), no audio track, and the
// poster = frame 0 as WebP.
async function encodeWeb(v, { FFMPEG, OUT, dir, mid, dur }) {
  const files = [];
  const fit = async (file, budget, args) => {
    let kbps = Math.floor(budget * 8 / dur / 1000 * 0.96);
    for (;;) {
      await args(kbps);
      const size = fs.statSync(file).size;
      if (size <= budget) { files.push({ file: path.basename(file), bytes: size, kbps }); return; }
      kbps = Math.floor(kbps * budget / size * 0.97);
    }
  };
  for (const z of v.web.sizes) {
    const base = path.join(OUT, `${v.web.name}${z.suffix}`), vf = `scale=${z.w}:${z.h}:flags=lanczos`, pl = path.join(dir, `pass${z.suffix}`);
    await fit(`${base}.mp4`, z.mp4, async kbps => {
      const c = ['-y', '-loglevel', 'error', '-i', mid, '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.6)}k`, '-bufsize', `${kbps * 3}k`,
        '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-g', String(FPS * 4), '-r', String(FPS), '-passlogfile', pl];
      await run(FFMPEG, [...c, '-pass', '1', '-f', 'mp4', '/dev/null']);
      await run(FFMPEG, [...c, '-pass', '2', '-movflags', '+faststart', `${base}.mp4`]);
    });
    await fit(`${base}.webm`, z.webm, async kbps => {
      const c = ['-y', '-loglevel', 'error', '-i', mid, '-an', '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.6)}k`, '-minrate', `${Math.round(kbps * .3)}k`,
        '-row-mt', '1', '-tile-columns', '2', '-g', String(FPS * 4), '-pix_fmt', 'yuv420p', '-r', String(FPS), '-passlogfile', pl + 'vp9'];
      await run(FFMPEG, [...c, '-pass', '1', '-deadline', 'good', '-cpu-used', '4', '-f', 'webm', '/dev/null']);
      await run(FFMPEG, [...c, '-pass', '2', '-deadline', 'good', '-cpu-used', '1', '-auto-alt-ref', '1', '-lag-in-frames', '25', `${base}.webm`]);
    });
  }
  const poster = path.join(OUT, `${v.web.name}.webp`), top = v.web.sizes[0];
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', mid, '-frames:v', '1', '-vf', `scale=${top.w}:${top.h}:flags=lanczos`, '-c:v', 'libwebp', '-quality', '78', poster]);
  files.push({ file: path.basename(poster), bytes: fs.statSync(poster).size });
  for (const f of files) console.log(`${v.id}  ${f.file}  ${(f.bytes / 1e6).toFixed(2)} MB${f.kbps ? `  ${f.kbps} kbps` : ''}`);
  return files;
}

export async function render({ CAP, WORK, OUT, FFMPEG, chromium, ids, videos = VIDEOS, manifestFile }) {
  fs.mkdirSync(OUT, { recursive: true });
  const todo = videos.filter(v => !ids || ids.includes(v.id));
  const mfile = manifestFile || path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(mfile) ? JSON.parse(fs.readFileSync(mfile, 'utf8')) : [];
  const browser = await chromium.launch({ channel: 'chromium' });
  const CONC = Number(process.env.VIDEO_CONCURRENCY || 3);
  const errors = [];
  try {
    const queue = [...todo];
    await Promise.all([...Array(CONC)].map(async () => {
      for (let v; (v = queue.shift());) {
        try {
          const m = await renderOne(v, { CAP, WORK, OUT, FFMPEG, browser });
          if (!v.loop) for (const [k, lim] of [['primary_text', 400], ['headline', 40], ['description', 60]]) if (m[k].length > lim) throw new Error(`${v.id}: ${k} is ${m[k].length} chars (> ${lim})`);
          const i = manifest.findIndex(x => x.id === m.id);
          if (i >= 0) manifest[i] = m; else manifest.push(m);
        } catch (e) { errors.push(e); console.error(`${v.id} FAILED: ${e.message}`); }
      }
    }));
  } finally { await browser.close(); }
  manifest.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(mfile, JSON.stringify(manifest, null, 2) + '\n');
  if (errors.length) throw new Error(`${errors.length} video(s) failed`);
}
