// MCP tool definitions and handlers.
//
// Every tool here is backed by a query that actually runs. Tools the data
// cannot support (email analysis, spend estimates, creative "inspiration
// packs") are not declared — an assistant must not be told a capability exists
// when calling it would return invented content.
import { listShops, getShop, similarShops, categories } from '@/lib/market/shops';
import { listAds, getAd, storeAds, labelFacets } from '@/lib/market/creatives';
import { listWinningProducts } from '@/lib/market/products';
import { LANDING_PAGE_TYPES, listLandingPages } from '@/lib/market/landing-pages';
import { LABEL_TAXONOMY, cleanLabelValues } from '@/lib/market/labels';
import { trackersWithState, changeFeed } from '@/lib/trackers';
import { addTracker, removeTracker, categoryAdRanking } from '@/lib/data';

export interface ToolContext {
  workspaceId: string;
  userId: string;
  scopes: string[];
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  scope: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

const str = (d: string) => ({ type: 'string', description: d });
const int = (d: string, min?: number, max?: number) => ({
  type: 'integer', description: d,
  ...(min !== undefined ? { minimum: min } : {}),
  ...(max !== undefined ? { maximum: max } : {}),
});

function obj(props: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties: props, required, additionalProperties: false };
}

/**
 * Trim a shop to the fields an assistant can reason about.
 *
 * `trafficSource` is load-bearing and always stated: 'similarweb' is a
 * measurement of that exact host, 'index' is the market index's own estimate —
 * often the PARENT domain's traffic for a storefront on a subdomain — which
 * stands only until the SimilarWeb crawl reaches the store. An assistant that
 * compares the two without knowing which is which will draw a false conclusion,
 * so `trafficNote` spells it out in words as well.
 */
function shopSummary(s: Awaited<ReturnType<typeof getShop>>) {
  if (!s) return null;
  const measured = s.trafficSource === 'similarweb';
  const sw = s.similarweb;
  return {
    id: s.id, name: s.name, domain: s.domain, country: s.country,
    categories: s.niches,
    monthlyVisits: s.monthlyVisits || null,
    trafficSource: s.trafficSource,
    trafficMeasured: measured,
    /** The month the visits measure, when the source states one. */
    trafficMonth: sw?.period || null,
    trafficNote: s.monthlyVisits > 0
      ? (measured
        ? `Measured by SimilarWeb for ${s.domain}${sw?.period ? ` in ${sw.period}` : ''}.`
        : 'The market index\u2019s own estimate, not a measurement of this host: for a storefront '
          + 'on a subdomain it is usually the parent domain\u2019s traffic. It is replaced by a '
          + 'SimilarWeb figure once the crawl reaches this store.')
      : null,
    /** Only ever SimilarWeb's real rank; the index's sentinel rank is not exposed. */
    globalRank: measured ? sw?.globalRank ?? null : null,
    countryRank: measured && sw?.countryCode ? { country: sw.countryCode, rank: sw.countryRank } : null,
    trafficHistory: s.trafficSeries.filter(p => p.t).map(p => ({ month: p.t, visits: p.v })),
    visitsGrowthPct: (measured ? sw?.growthPct ?? null : s.visitsGrowth) || null,
    liveAds: s.metaAds || null,
    productCount: s.productCount || null,
    averagePrice: s.avgPrice || null,
    storeOpened: s.createdOn || null,
    description: s.description || null,
    url: `https://${s.domain}`,
  };
}

/** Shared wording: every tool that surfaces AI labels says what they are. */
const LABELS_NOTE =
  'AI labels (hook, angle, funnel stage, offer, urgency) are model classifications of the ad text, ' +
  'each with a confidence from 0 to 1. A label is absent when the model was not confident enough, ' +
  'and absence is not evidence of anything: it does not mean the ad has no hook or no offer. ' +
  'They are judgments, not measurements of performance.';

const labelArray = (field: keyof typeof LABEL_TAXONOMY, what: string) => ({
  type: 'array',
  items: { type: 'string', enum: [...LABEL_TAXONOMY[field]] },
  description: `Only creatives the model labeled with one of these ${what} (OR within the list). Unlabeled creatives are excluded.`,
});

function adSummary(a: NonNullable<Awaited<ReturnType<typeof getAd>>>) {
  return {
    id: a.id, advertiser: a.advertiser, domain: a.domain, network: a.network,
    headline: a.headline || null, copy: a.adCopy || null,
    mediaType: a.mediaType, imageUrl: a.image || null,
    views: a.reach || null, daysRunning: a.daysRunning || null,
    startDate: a.startDate || null, country: a.country || null,
    storeCreativeCount: a.variations || null,
    labels: a.labels,
  };
}

export const TOOLS: ToolDef[] = [
  {
    name: 'search_shops',
    title: 'Search shops',
    description: 'Search the Shopify store index by keyword, category, country, traffic, catalogue size or live ad count. Returns matching stores with their metrics, each traffic figure labelled with the source it was measured from.',
    scope: 'discovery.read',
    inputSchema: obj({
      query: str('Free-text match on store name or domain.'),
      country: str('Two-letter country code, e.g. US or GB.'),
      category: str('Category name, e.g. "Skincare & Body Care". Use list_categories for valid values.'),
      minProducts: int('Only stores with at least this many products in their catalogue.', 0),
      maxProducts: int('Only stores with at most this many products.', 0),
      sortBy: {
        type: 'string',
        enum: ['traffic', 'similarwebRank', 'growth', 'ads', 'products', 'newest'],
        description: 'Ranking field. Defaults to traffic, which is SimilarWeb visits measured for the '
          + 'exact store host; growth is SimilarWeb\u2019s measured month-over-month change. For both, '
          + 'stores the crawl has not reached yet rank last, keeping their index order underneath rather '
          + 'than dropping out of the results.',
      },
      limit: int('Number of results, 1-50. Defaults to 10.', 1, 50),
    }),
    async handler(args) {
      const cats = await categories();
      const categoryId = args.category
        ? Object.entries(cats).find(([, name]) => name.toLowerCase() === String(args.category).toLowerCase())?.[0]
        : undefined;
      const sortMap: Record<string, string> = {
        traffic: 'sw_visits', similarwebRank: 'sw_global_rank',
        growth: 'sw_growth_pct', ads: 'db_num_ads',
        products: 'total_product', newest: 'store_created_at',
      };
      const { items, total } = await listShops({
        q: args.query as string | undefined,
        country: args.country as string | undefined,
        category: categoryId,
        productsMin: args.minProducts as number | undefined,
        productsMax: args.maxProducts as number | undefined,
        sortBy: sortMap[String(args.sortBy ?? 'traffic')] ?? 'sw_visits',
        // Every field here reads best-first descending except a rank, where #1
        // is the top of the list: desc would have returned the worst-ranked.
        sortOrder: args.sortBy === 'similarwebRank' ? 'asc' : 'desc',
        limit: Math.min(50, Number(args.limit) || 10),
      });
      return { totalInIndex: total, count: items.length, shops: items.map(shopSummary) };
    },
  },

  {
    name: 'get_shop',
    title: 'Get a shop',
    description: 'Full detail for one store: SimilarWeb traffic (visits, month-over-month, measured history, global/country/category rank, engagement, traffic-source mix, top countries and keywords) where the crawl has reached it, plus catalogue, live ad count and category. Accepts the shop id from search_shops or a bare domain.',
    scope: 'discovery.read',
    inputSchema: obj({ shop: str('Shop id (shp_…) or domain (example.com).') }, ['shop']),
    async handler(args) {
      const shop = await getShop(String(args.shop));
      if (!shop) return { found: false, message: 'No store in the index matches that id or domain.' };
      const ads = await storeAds(shop.domain, 8).catch(() => []);
      const sw = shop.similarwebDetail;
      return {
        found: true,
        shop: shopSummary(shop),
        // Absent entirely when the SimilarWeb crawl has not reached this store —
        // never an empty shell of nulls that would read as measured zeroes.
        similarweb: sw ? {
          domain: sw.domain,
          month: sw.period || null,
          visits: sw.visits,
          previousMonthVisits: sw.prevVisits || null,
          growthPct: sw.growthPct,
          history: sw.history.map(p => ({ month: p.t, visits: p.v })),
          globalRank: sw.globalRank,
          countryRank: sw.countryCode ? { country: sw.countryCode, rank: sw.countryRank } : null,
          categoryRank: sw.category ? { category: sw.category, rank: sw.categoryRank } : null,
          engagement: {
            pagesPerVisit: sw.pagesPerVisit,
            bounceRate: sw.bounceRate,
            averageVisitSeconds: sw.avgVisitSeconds,
          },
          trafficSourcesPct: Object.fromEntries(sw.sources.map(r => [r.key, r.pct])),
          topCountriesPct: sw.geo.map(c => ({ country: c.code, pct: c.pct })),
          topKeywords: sw.keywords,
          aiReferralVisits: sw.aiReferralVisits,
          smallSite: sw.smallSite,
          fromGoogleAnalytics: sw.fromGa,
          coverage: sw.coverage || null,
          snapshotDate: sw.snapshotDate || null,
        } : null,
        catalogue: shop.bestSellers.map(p => ({ title: p.title, price: p.price || null, currency: p.currency, imageUrl: p.image ?? null })),
        recentCreatives: ads.map(adSummary),
      };
    },
  },

  {
    name: 'find_similar_shops',
    title: 'Find similar shops',
    description: 'Stores in the same category with the nearest traffic level to a given store.',
    scope: 'discovery.read',
    inputSchema: obj({
      shop: str('Shop id or domain to find lookalikes for.'),
      limit: int('How many to return, 1-20. Defaults to 6.', 1, 20),
    }, ['shop']),
    async handler(args) {
      const shop = await getShop(String(args.shop));
      if (!shop) return { found: false, message: 'No store in the index matches that id or domain.' };
      const similar = await similarShops(shop, Math.min(20, Number(args.limit) || 6));
      return { found: true, basis: { id: shop.id, name: shop.name, categories: shop.niches }, shops: similar.map(shopSummary) };
    },
  },

  {
    name: 'search_products',
    title: 'Search winning products',
    description: 'Search storefront products that Meta ads send traffic to (each ad\u2019s landing URL is a product page), '
      + 'ranked by the ads behind them. Every product carries its storefront title, price in the store\u2019s own currency, '
      + 'product URL, active ad count, ads started in the last 14 days, advertiser pages, first-ad date and the store with its traffic.',
    scope: 'discovery.read',
    inputSchema: obj({
      query: str('Words that must all appear in the product title, vendor, type or store domain.'),
      category: str('Store category name, e.g. "Skincare & Body Care". Use list_categories for valid values.'),
      country: str('Two-letter country code the ads run in, e.g. US.'),
      currency: str('Three-letter currency code; required for minPrice/maxPrice and the price sort.'),
      minPrice: { type: 'number', description: 'Minimum price in `currency`.' },
      maxPrice: { type: 'number', description: 'Maximum price in `currency`.' },
      store: str('Only this store\u2019s products (domain, e.g. example.com).'),
      firstAdWithinDays: int('Only products whose first ad started within this many days.', 1, 365),
      sortBy: {
        type: 'string',
        enum: ['ads', 'new_ads', 'pages', 'traffic', 'growth', 'first_ad', 'published', 'price'],
        description: 'Ranking field. Defaults to ads (active ads landing on the product). new_ads = ads started in the '
          + 'last 14 days; pages = distinct advertiser pages; traffic/growth = the store\u2019s monthly visits and their change.',
      },
      limit: int('Number of results, 1-50. Defaults to 10.', 1, 50),
    }),
    async handler(args) {
      const cats = await categories();
      const categoryId = args.category
        ? Object.entries(cats).find(([, name]) => name.toLowerCase() === String(args.category).toLowerCase())?.[0]
        : undefined;
      const r = await listWinningProducts({
        q: args.query as string | undefined,
        category: categoryId,
        country: args.country as string | undefined,
        currency: args.currency as string | undefined,
        priceMin: args.minPrice != null ? String(args.minPrice) : undefined,
        priceMax: args.maxPrice != null ? String(args.maxPrice) : undefined,
        store: args.store as string | undefined,
        launched: args.firstAdWithinDays != null ? String(args.firstAdWithinDays) : undefined,
        sort: args.sortBy as string | undefined,
        limit: Math.min(50, Number(args.limit) || 10),
      });
      return {
        total: r.total,
        count: r.items.length,
        products: r.items.map(p => ({
          title: p.title, url: p.url, imageUrl: p.image || null,
          price: p.price, compareAtPrice: p.compareAtPrice, currency: p.currency || null,
          activeAds: p.activeAds, adsLast14Days: p.newAds14d, advertiserPages: p.pages,
          firstAdAt: p.firstAdAt, publishedAt: p.publishedAt, adCountries: p.adCountries,
          sampleAdIds: p.sampleAds.map(a => a.id),
          store: {
            shopId: p.store.id ? `shp_${p.store.id}` : null, domain: p.store.domain, country: p.store.country || null,
            monthlyVisits: p.store.visits || null, visitsGrowthPct: p.store.visitsGrowthPct,
            trafficSource: p.store.trafficSource,
          },
        })),
      };
    },
  },

  {
    name: 'search_landing_pages',
    title: 'Search ad landing pages',
    description: 'Search the pages Meta ads send people to (product pages, advertorials, listicles, quizzes, collections, homepages), '
      + 'ranked by the ads behind them. Each page carries its URL, title, page type, screenshot or share image, active ad count, '
      + 'ads started in the last 14 days, advertiser pages, first/last seen dates, ad countries and the store with its traffic.',
    scope: 'discovery.read',
    inputSchema: obj({
      query: str('Words that must all appear in the page title, URL or store domain.'),
      category: str('Store category name, e.g. "Skincare & Body Care". Use list_categories for valid values.'),
      country: str('Two-letter country code the ads run in, e.g. US.'),
      pageType: { type: 'string', enum: [...LANDING_PAGE_TYPES], description: 'Kind of page.' },
      store: str('Only this store\u2019s pages (domain, e.g. example.com).'),
      firstAdWithinDays: int('Only pages whose first ad started within this many days.', 1, 365),
      sortBy: {
        type: 'string',
        enum: ['ads', 'new_ads', 'pages', 'traffic', 'growth', 'first_ad', 'last_seen'],
        description: 'Ranking field. Defaults to ads (active ads sending people to the page). new_ads = ads started in the '
          + 'last 14 days; pages = distinct advertiser pages; traffic/growth = the store\u2019s monthly visits and their change.',
      },
      limit: int('Number of results, 1-50. Defaults to 10.', 1, 50),
    }),
    async handler(args) {
      const cats = await categories();
      const categoryId = args.category
        ? Object.entries(cats).find(([, name]) => name.toLowerCase() === String(args.category).toLowerCase())?.[0]
        : undefined;
      const r = await listLandingPages({
        q: args.query as string | undefined,
        category: categoryId,
        country: args.country as string | undefined,
        type: args.pageType as string | undefined,
        store: args.store as string | undefined,
        launched: args.firstAdWithinDays != null ? String(args.firstAdWithinDays) : undefined,
        sort: args.sortBy as string | undefined,
        limit: Math.min(50, Number(args.limit) || 10),
      });
      if (r.building) return { total: 0, count: 0, message: 'Landing pages are still being gathered; try again in a minute.', landingPages: [] };
      return {
        total: r.total,
        count: r.items.length,
        landingPages: r.items.map(lp => ({
          title: lp.title || null, url: lp.url, pageType: lp.type,
          screenshotUrl: lp.screenshot || null, imageUrl: lp.image || null,
          ads: lp.ads, activeAds: lp.activeAds, adsLast14Days: lp.newAds14d, advertiserPages: lp.pages,
          firstAdAt: lp.firstAdAt, lastSeenAt: lp.lastSeenAt, adCountries: lp.adCountries,
          sampleAdIds: lp.sampleAds.map(a => a.id),
          store: {
            shopId: lp.store.id ? `shp_${lp.store.id}` : null, domain: lp.store.domain, country: lp.store.country || null,
            monthlyVisits: lp.store.visits || null, visitsGrowthPct: lp.store.visitsGrowthPct,
            trafficSource: lp.store.trafficSource,
          },
        })),
      };
    },
  },

  {
    name: 'search_ads',
    title: 'Search ad creatives',
    description: 'Search indexed ad creatives by keyword, network, media type, country or AI creative label. ' +
      'Each ad carries `labels` (null when unlabeled). ' + LABELS_NOTE,
    scope: 'discovery.read',
    inputSchema: obj({
      query: str('Free-text match on ad copy, headline or advertiser.'),
      network: { type: 'string', enum: ['meta', 'tiktok'], description: 'Ad network.' },
      mediaType: { type: 'string', enum: ['image', 'video', 'vsl'], description: 'Creative format. vsl = video sales letter (video of 2+ minutes).' },
      country: str('Two-letter country code.'),
      hook: labelArray('hook', 'hooks'),
      angle: labelArray('angle', 'angles'),
      funnelStage: labelArray('funnelStage', 'funnel stages'),
      offer: labelArray('offer', 'offer types'),
      urgency: { type: 'boolean', description: 'true = only creatives the model judged to use urgency.' },
      includeNonStores: { type: 'boolean', description: 'true = also include advertisers that are not online stores (big brands, publishers). Default false: only known online stores.' },
      limit: int('Number of results, 1-50. Defaults to 12.', 1, 50),
    }),
    async handler(args, ctx) {
      const { items, total } = await listAds({
        storesOnly: args.includeNonStores !== true,
        q: args.query as string | undefined,
        network: args.network as string | undefined,
        media: args.mediaType as 'image' | 'video' | 'vsl' | undefined,
        country: args.country as string | undefined,
        hook: cleanLabelValues('hook', args.hook),
        angle: cleanLabelValues('angle', args.angle),
        funnelStage: cleanLabelValues('funnelStage', args.funnelStage),
        offer: cleanLabelValues('offer', args.offer),
        urgency: args.urgency === true,
        limit: Math.min(50, Number(args.limit) || 12),
      });
      return { totalInIndex: total, count: items.length, ads: items.map(adSummary) };
    },
  },

  {
    name: 'get_ad',
    title: 'Get an ad creative',
    description: 'Everything the index records about one ad creative, including its AI labels. ' + LABELS_NOTE,
    scope: 'discovery.read',
    inputSchema: obj({ adId: str('Creative id from search_ads.') }, ['adId']),
    async handler(args, ctx) {
      const ad = await getAd(String(args.adId));
      return ad ? { found: true, ad: adSummary(ad) } : { found: false, message: 'No creative with that id.' };
    },
  },

  {
    name: 'creative_breakdown',
    title: 'Creative breakdown for a shop',
    description: 'How one store\'s ad creatives split by AI label: counts per hook, angle, funnel stage, offer and urgency, ' +
      'plus how many of its creatives carry any label (`labeled`) out of all indexed (`total`). ' +
      'Compute shares against `labeled`, not `total`. ' + LABELS_NOTE,
    scope: 'discovery.read',
    inputSchema: obj({
      shop: str('Shop id (shp_…) or domain (example.com).'),
      country: str('Two-letter country code, to limit to creatives targeting that country.'),
      days: int('Only creatives that started within the last N days.', 1, 3650),
    }, ['shop']),
    async handler(args, ctx) {
      const shop = await getShop(String(args.shop));
      if (!shop) return { found: false, message: 'No store in the index matches that id or domain.' };
      const days = Number(args.days);
      const facets = await labelFacets({
        storeDomain: shop.domain,
        country: args.country as string | undefined,
        days: Number.isInteger(days) && days > 0 ? days : undefined,
      });
      if (!facets) return { found: true, available: false, message: 'Label counts could not be retrieved. Nothing is inferred.' };
      if (facets.labeled === 0) {
        return {
          found: true, shop: { id: shop.id, name: shop.name, domain: shop.domain },
          total: facets.total, labeled: 0,
          message: 'None of this store\'s creatives carry a confident AI label yet.',
        };
      }
      return {
        found: true,
        shop: { id: shop.id, name: shop.name, domain: shop.domain },
        total: facets.total,
        labeled: facets.labeled,
        facets: facets.facets,
      };
    },
  },

  {
    name: 'list_categories',
    title: 'List categories',
    description: 'Every store category the index uses, for passing to search_shops.',
    scope: 'discovery.read',
    inputSchema: obj({}),
    async handler() {
      const cats = await categories();
      return { categories: Object.values(cats).sort() };
    },
  },

  {
    name: 'trending_categories',
    title: 'Trending categories',
    description: 'Store categories ranked by total creative (ad) count in the current index snapshot.',
    scope: 'discovery.read',
    inputSchema: obj({ limit: int('How many categories, 1-50. Defaults to 15.', 1, 50) }),
    async handler(args) {
      const cats = await categoryAdRanking(Math.min(50, Number(args.limit) || 15));
      return {
        note: 'Ranked from the full index snapshot by server-side creative_count, not a time series.',
        categories: cats,
      };
    },
  },

  {
    name: 'list_tracked_brands',
    title: 'List tracked brands',
    description: 'Brands this workspace tracks, with their latest recorded metrics.',
    scope: 'brandtrackers.read',
    inputSchema: obj({}),
    async handler(_args, ctx) {
      const trackers = await trackersWithState(ctx.workspaceId);
      return {
        count: trackers.length,
        brands: trackers.map(t => ({
          shopId: t.shopId, name: t.name, domain: t.domain,
          trackedSince: t.createdAt.toISOString().slice(0, 10),
          lastRecordedAt: t.latestAt ? t.latestAt.toISOString() : null,
          latest: t.latest,
        })),
      };
    },
  },

  {
    name: 'brand_changes',
    title: 'Tracked brand changes',
    description: 'Metrics that moved between the last two recordings of each tracked brand. Empty until a brand has at least two recordings.',
    scope: 'brandtrackers.read',
    inputSchema: obj({ limit: int('How many changes, 1-100. Defaults to 25.', 1, 100) }),
    async handler(args, ctx) {
      const trackers = await trackersWithState(ctx.workspaceId);
      const changes = changeFeed(trackers).slice(0, Math.min(100, Number(args.limit) || 25));
      return {
        count: changes.length,
        awaitingBaseline: trackers.filter(t => !t.previous).length,
        changes: changes.map(c => ({
          shopId: c.shopId, name: c.name, domain: c.domain,
          metric: c.metric, from: c.from, to: c.to, changePct: c.deltaPct,
          recordedAt: c.at.toISOString(),
        })),
      };
    },
  },

  {
    name: 'track_brand',
    title: 'Track a brand',
    description: 'Add a store to this workspace\'s brandtracker so its metrics are recorded on a schedule.',
    scope: 'brandtrackers.write',
    inputSchema: obj({ shop: str('Shop id or domain to track.') }, ['shop']),
    async handler(args, ctx) {
      const shop = await getShop(String(args.shop));
      if (!shop) return { ok: false, message: 'No store in the index matches that id or domain.' };

      await addTracker(ctx.workspaceId, ctx.userId, { id: shop.id, domain: shop.domain, name: shop.name });
      return { ok: true, tracking: { shopId: shop.id, name: shop.name, domain: shop.domain } };
    },
  },

  {
    name: 'untrack_brand',
    title: 'Stop tracking a brand',
    description: 'Remove a store from this workspace\'s brandtracker.',
    scope: 'brandtrackers.write',
    inputSchema: obj({ shopId: str('Shop id currently tracked.') }, ['shopId']),
    async handler(args, ctx) {
      await removeTracker(ctx.workspaceId, String(args.shopId));
      return { ok: true };
    },
  },

];

export const ALL_SCOPES = [...new Set(TOOLS.map(t => t.scope))].sort();

export function toolByName(name: string): ToolDef | undefined {
  return TOOLS.find(t => t.name === name);
}

