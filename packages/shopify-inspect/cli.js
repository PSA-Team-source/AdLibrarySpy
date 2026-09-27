#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { inspectStore } from './index.js';
import { indexCard } from './index-card.js';
import { CSV_COLUMNS, csvRow } from './csv.js';

const HELP = `shopify-inspect — what any Shopify store publishes about itself

Usage
  npx shopify-inspect <domain> [<domain> ...] [options]

Options
  --json        Print JSON instead of the summary
  --csv         Print CSV instead of the summary
  --limit <n>   Best sellers / newest products to list (1-50, default 12)
  --offline     Skip the AdLibrarySpy index lookup (traffic, live ads)
  -h, --help

Examples
  npx shopify-inspect allbirds.com
  npx shopify-inspect gymshark.com skims.com --json`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean' }, csv: { type: 'boolean' }, offline: { type: 'boolean' },
    limit: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  },
});
if (values.help || !positionals.length) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = s => c(1, s), dim = s => c(2, s), green = s => c(32, s), red = s => c(31, s);
const num = n => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = (n, ccy) => {
  if (n == null) return '';
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: ccy || 'USD' }).format(n); } catch { return String(n); }
};

async function one(domain) {
  const store = await inspectStore(domain, { limit: values.limit ? Number(values.limit) : undefined });
  let index = null, indexError = null;
  if (!values.offline && store.shopify) {
    try { index = await indexCard(store.domain); } catch (err) { indexError = err.message; }
  }
  return { ...store, index, ...(indexError ? { indexError } : {}) };
}

function print(s) {
  const out = [];
  const row = (k, v) => { if (v != null && v !== '') out.push(`  ${dim(k.padEnd(14))}${v}`); };
  out.push(bold(s.name ? `${s.name}  ${dim(s.domain)}` : s.domain));
  if (!s.shopify) {
    out.push(`  ${red('Not a Shopify storefront')} ${dim('(no Shopify runtime, meta.json or products.json)')}`);
    return out.join('\n');
  }
  row('myshopify', s.myshopifyDomain);
  row('theme', s.theme);
  row('currency', s.currency);
  row('locale', s.locale);
  row('products', s.productCount != null ? s.productCount.toLocaleString('en') : null);
  if (s.prices) row('prices', `${money(s.prices.min, s.currency)} – ${money(s.prices.max, s.currency)}, median ${money(s.prices.median, s.currency)} ${dim(`(${s.prices.sampled} sampled)`)}`);
  const t = s.index?.traffic;
  if (t) {
    const g = t.growthPct == null ? '' : ` ${t.growthPct >= 0 ? green(`+${t.growthPct}%`) : red(`${t.growthPct}%`)}`;
    row('traffic', `${num(t.visits)}/mo${g} ${dim(t.sourceLabel ? `(${t.sourceLabel})` : '')}`);
  }
  if (s.index?.metaAds?.live) row('live Meta ads', num(s.index.metaAds.live));
  if (s.index?.niche?.length) row('niche', s.index.niche.join(' › '));
  if (s.pixels.length) row('pixels', s.pixels.join(', '));
  if (s.apps.length) row('apps', s.apps.join(', '));
  const list = (title, items) => {
    if (!items.length) return;
    out.push(`  ${dim(title)}`);
    for (const p of items) out.push(`    ${String(p.rank).padStart(2)}. ${p.title}${p.price != null ? dim(`  ${money(p.price, p.currency)}`) : ''}`);
  };
  list('best sellers', s.bestSelling);
  list('newest', s.newest);
  if (s.index?.urls?.analysis) out.push(`  ${dim('full report')}   ${s.index.urls.analysis}`);
  return out.join('\n');
}

let failed = 0;
const results = await Promise.all(positionals.map(d => one(d).catch(err => { failed++; return { domain: d, error: err.message }; })));
if (values.csv) {
  console.log(CSV_COLUMNS.join(','));
  console.log(results.map(csvRow).join('\n'));
} else if (values.json) {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  console.log(results.map(r => (r.error ? `${bold(r.domain)}\n  ${red(r.error)}` : print(r))).join('\n\n'));
}
process.exit(failed ? 1 : 0);
