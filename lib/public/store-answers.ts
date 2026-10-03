// Question-shaped facts for a public store page: what people ask an answer
// engine about a store ("how much traffic does X get?"), answered only from
// measured values. A question whose number is missing is not asked. Pure (no
// path-alias imports) so tests/store-answers.test.mjs runs it directly.

export interface StoreAnswerInput {
  name: string;
  domain: string;
  /** SimilarWeb-measured monthly visits for this exact host; 0 = not measured. */
  visits: number;
  /** "Aug 2026" for the visits figure; '' when unknown. */
  visitsMonth: string;
  /** Month-over-month change of the same measurement, percent. */
  growthPct: number | null;
  /** Live Meta ads recorded for the store; 0 = none recorded. */
  liveAds: number;
  platform: string;
  /** ISO date the store was created. */
  createdOn: string;
  /** Full country name. */
  country: string;
  niche: string;
  apps: string[];
  pixels: string[];
  similar: string[];
}

const nf = new Intl.NumberFormat('en-US');
const platformName: Record<string, string> = { shopify: 'Shopify', woocommerce: 'WooCommerce', shopline: 'Shopline', shoplazza: 'Shoplazza', wix: 'Wix', square: 'Square', squarespace: 'Squarespace' };
const list = (xs: string[]) => xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function storeAnswers(s: StoreAnswerInput): [string, string][] {
  const out: [string, string][] = [];
  if (s.visits > 0) {
    const when = s.visitsMonth ? ` in ${s.visitsMonth}` : ' a month';
    const g = s.growthPct != null && Math.round(s.growthPct) !== 0
      ? ` That is ${s.growthPct > 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.growthPct))}% on the month before.` : '';
    out.push([`How much traffic does ${s.domain} get?`, `${s.domain} had ${nf.format(Math.round(s.visits))} visits${when}, as measured by SimilarWeb for this exact host.${g}`]);
  }
  if (s.liveAds > 0) {
    out.push([`Is ${s.name} running Facebook and Instagram ads?`, `Yes. AdLibrarySpy recorded ${nf.format(s.liveAds)} live Meta ads for ${s.domain} in the Meta Ad Library.`]);
  }
  const platform = platformName[s.platform];
  if (platform) {
    const extra = s.apps.length ? ` Apps detected on its homepage include ${list(s.apps.slice(0, 5))}.` : '';
    out.push([`What platform is ${s.domain} built on?`, `${s.domain} runs on ${platform}.${extra}`]);
  }
  const year = s.createdOn ? new Date(s.createdOn).getUTCFullYear() : NaN;
  if (Number.isFinite(year) || s.country) {
    const parts = [Number.isFinite(year) && `was created in ${year}`, s.country && `is based in ${s.country}`].filter(Boolean);
    out.push([`When was ${s.name} founded and where is it based?`, `${s.name} ${parts.join(' and ')}.`]);
  }
  if (s.pixels.length) {
    out.push([`Which tracking pixels does ${s.domain} use?`, `${list(s.pixels.slice(0, 6))} ${s.pixels.length === 1 ? 'was' : 'were'} found on its homepage.`]);
  }
  if (s.similar.length) {
    out.push([`What stores are similar to ${s.name}?`, `${list(s.similar.slice(0, 5))}${s.niche ? `, in the same ${s.niche} niche at a similar traffic level` : ''}.`]);
  }
  return out;
}
