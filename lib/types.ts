// Domain types — field names mirror PlatformDTC's market schema
// (top_brands: similar_web, db_num_ads, num_ads_increase%,
//  total_product, avg_product_price; creatives: ad_type/start_at/store_url;
//  market_products) so this UI is a drop-in over the existing ClickHouse/ES data.

export type Platform = 'shopify' | 'woocommerce' | 'magento' | 'shoplazza' | 'custom';
export type Network = 'meta' | 'tiktok' | 'google';

export interface Point { t: string; v: number }
export interface CountryShare { code: string; pct: number }

/**
 * SimilarWeb site-overview figures, measured for the EXACT store host
 * (top_brands.sw_*, written by the platform's SimilarWeb crawl).
 *
 * `Shop.similarweb === null` means the crawl has not reached this store yet —
 * never that it has no traffic. Inside, a null/'' field means SimilarWeb
 * publishes no such value for the host; nothing here is ever defaulted to 0.
 */
export interface SimilarWebFacts {
  /** The month the visits measure, "2026-08". '' = the period was not stated. */
  period: string;
  /** Visits in `period`. Always > 0 — a store with no measurement has no facts object. */
  visits: number;
  /** Visits in the month before `period`. 0 = no earlier month was measured. */
  prevVisits: number;
  /** Month-over-month change, e.g. -4.62. null = no earlier month to compare against. */
  growthPct: number | null;
  /** Real global rank for this host. null = SimilarWeb publishes none (never a sentinel). */
  globalRank: number | null;
  /** Country the country rank belongs to, "US". '' = no country ranking published. */
  countryCode: string;
  /** Rank within `countryCode`. null = none published. */
  countryRank: number | null;
  /** SimilarWeb category slug, "lifestyle/fashion_and_apparel". '' = uncategorised. */
  category: string;
  /** Rank within `category`. null = none published. */
  categoryRank: number | null;
  /** SimilarWeb's own coverage flag, "complete" or a partial value. '' = not stated. */
  coverage: string;
  /** Date of the crawled snapshot, "2026-08-01". '' = not stated. */
  snapshotDate: string;
}

/** One traffic-source share, 0–100, as the source mix and geo bars render them. */
export interface ShareRow { key: string; label: string; pct: number }

/** One of SimilarWeb's top keywords for the host. Any figure may be absent. */
export interface SimilarWebKeyword {
  keyword: string;
  /** Monthly search volume. null = not published. */
  volume: number | null;
  /** Cost per click in USD. null = not published. */
  cpcUsd: number | null;
  /** SimilarWeb's estimated traffic value in USD. null = not published. */
  valueUsd: number | null;
}

/**
 * The full SimilarWeb dossier for one store (`similarweb_detail` on
 * /top-brands/{id}). Only the detail endpoint carries it; a list row carries
 * `SimilarWebFacts` alone. Every field is absent-means-unmeasured.
 */
export interface SimilarWebDetail extends SimilarWebFacts {
  /** The exact host SimilarWeb measured, which is the store's own domain. */
  domain: string;
  /** Measured months, ascending, up to 3. Fewer than 2 → no chart is drawn. */
  history: Point[];
  /** Pages per visit. null = not measured. */
  pagesPerVisit: number | null;
  /** Bounce rate as 0–1. null = not measured. */
  bounceRate: number | null;
  /** Average visit duration in seconds. null = not measured. */
  avgVisitSeconds: number | null;
  /** Traffic-source mix as 0–100 shares, largest first. Empty = not measured. */
  sources: ShareRow[];
  /** Top visitor countries as 0–100 shares, largest first. Empty = not measured. */
  geo: CountryShare[];
  /** Top keywords, highest volume first. Empty = none published. */
  keywords: SimilarWebKeyword[];
  /** Visits arriving from AI assistants. null = not measured. */
  aiReferralVisits: number | null;
  /** SimilarWeb flags the host as a small site (its figures are coarser there). */
  smallSite: boolean;
  /** The figures come from the site's own Google Analytics, not the panel. */
  fromGa: boolean;
  /** When the platform crawled this dossier, ISO. '' = not stated. */
  fetchedAt: string;
}

export interface Product {
  rank: number;
  title: string;
  price: number;
  currency: string;
  createdAt: string;
  image?: string;
  /** The product's page on the store, when known. */
  url?: string;
}

export interface Shop {
  id: string;
  name: string;
  domain: string;
  logo: string;         // favicon URL
  screenshot: string;   // website screenshot URL
  myshopifyDomain: string;
  platform: Platform;
  niches: string[];              // store_category
  country: string;
  language: string;
  currency: string;
  theme: string;                // shopify_theme
  createdOn: string;            // ISO
  /**
   * The visit figure to display. SimilarWeb's measurement for this exact host
   * when the crawl has reached the store (`trafficSource === 'similarweb'`),
   * otherwise the market index's own estimate (`'index'`) — which is often the
   * PARENT domain's traffic. 0 = neither exists; render nothing.
   */
  monthlyVisits: number;
  /** Month-over-month % for `monthlyVisits`, from the same source. */
  visitsGrowth: number;
  metaAds: number;              // db_num_ads
  tiktokAds: number;
  googleAds: number;
  emails: number;
  trustScore: number;
  trustReviews: number;
  productCount: number;         // total_product
  avgPrice: number;             // avg_product_price
  numAdsIncreasePct: number;    // percentage_num_ads_increase
  pixels: string[];
  apps: string[];
  trafficSeries: Point[];
  liveAdsSeries: Point[];
  /**
   * Where the store's visitors are, from SimilarWeb's geography breakdown
   * (shares 0–100, largest first). Empty = not measured; the block is omitted.
   */
  visitorCountries: CountryShare[];
  targetedCountries: CountryShare[];
  bestSellers: Product[];
  similarShopIds: string[];
  /** The store's page title as indexed, for tooltips. */
  fullTitle: string;
  /**
   * Global rank. SimilarWeb's real rank for this host when the crawl has
   * measured it; otherwise the index's own value, where the ~12.1M sentinel
   * band means SimilarWeb never ranked this exact host (see lib/traffic/crux.ts)
   * rather than that it ranks 12-millionth. 0 = no rank either way.
   */
  similarWebRank: number;
  /**
   * Chrome UX Report popularity band (1000 = top 1K … 50000000 = top 50M).
   * null means Chrome never saw enough real traffic to rank the domain, which
   * is itself a signal. Never invented.
   */
  cruxBucket: number | null;
  description: string;
  estimatedSalesCents: number;
  /**
   * Peak concurrent ads in the last 7 days (index field max_ads_7d).
   * null means the index never computed it (43% of rows), which is NOT the same
   * as a measured zero (15%) -- so it must render as "not measured", not "0".
   */
  maxAds7d: number | null;
  storeId: string;
  /** Which measurement the visit figures came from; null = not measured. */
  trafficSource: 'index' | 'similarweb' | 'semrush' | null;
  /**
   * SimilarWeb's measurement of this exact host, carried on every list row.
   * null = the crawl has not reached this store yet and the figures above are
   * the index's labelled estimate.
   */
  similarweb: SimilarWebFacts | null;
  /**
   * The full SimilarWeb dossier. Only /top-brands/{id} carries it, so it is
   * null on every list row as well as on an unmeasured store.
   */
  similarwebDetail: SimilarWebDetail | null;
}

/**
 * The fields the Shops explorer table renders. The browser receives this, not
 * the full Shop: a list row's technologies/apps/description alone tripled the
 * page payload without drawing a pixel.
 */
export type ShopRow = Pick<Shop,
  | 'id' | 'name' | 'domain' | 'fullTitle' | 'screenshot' | 'logo' | 'country' | 'platform'
  | 'createdOn' | 'bestSellers' | 'productCount' | 'niches' | 'trafficSource' | 'monthlyVisits'
  | 'cruxBucket' | 'similarWebRank' | 'similarweb' | 'visitorCountries' | 'trafficSeries'
  | 'metaAds' | 'targetedCountries' | 'liveAdsSeries' | 'visitsGrowth' | 'avgPrice' | 'maxAds7d'>;

/** One ad thumbnail in a Shops row. */
export type AdPreview = Pick<Ad, 'id' | 'image' | 'mediaType' | 'headline' | 'advertiser'>;

export interface Ad {
  id: string;
  network: Network;
  advertiser: string;
  shopId: string;
  domain: string;
  adCopy: string;
  headline: string;
  cta: string;
  mediaType: 'video' | 'image';
  image: string;        // creative thumbnail
  reach: number;
  spendTotal: number;
  spendPerDay: number;
  daysRunning: number;
  startDate: string;
  variations: number;
  targeting: string;            // Global | US | EU/UK | ...
  isEuUk: boolean;
  niche: string;
  growthPct: number;
  country: string;
  storeId: string;

  // --- fields the index actually carries that the first mapper discarded ---
  /** Playable MP4, only when hosted on our CDN (fbcdn originals 403 on hotlink). */
  videoUrl: string;
  /** The ad's real destination. 100% filled — no need to guess a product URL. */
  linkUrl: string;
  /** utm_* pairs decoded from linkUrl; empty when the advertiser sets none. */
  utm: Record<string, string>;
  /** facebook | instagram | threads | messenger | whatsapp | audience_network */
  placements: string[];
  /** dco | dpa | carousel | video | image — Meta's own creative taxonomy. */
  format: string;
  isActive: boolean;
  lastSeenAt: string;
  adsRunning: number;
  maxAds7d: number;
  storeLogo: string;
  /** Meta page/post ids, so a creative can be traced back to the live ad. */
  pageId: string;
  postId: string;
  related: { id: string; image: string; isVideo: boolean }[];
  /**
   * AI creative labels (lib/market/labels.ts): model judgments of the ad text,
   * not measurements. null = not labeled yet or no label passed the confidence
   * bar. A missing key inside = no confident judgment for that dimension.
   */
  labels: AdLabels | null;
  /** When our crawler first indexed this creative (ISO); '' when unknown. */
  firstSeenAt: string;
  storeDescription: string;
  storeCreatedAt: string;
  /** store_categories ids, broadest first; names come from categories(). */
  storeCategoryIds: string[];
}

/** One classifier judgment. `label` is the API's display string. */
export interface AdLabel { value: string; label: string; confidence: number }

export interface AdLabels {
  hook?: AdLabel;
  angle?: AdLabel;
  funnelStage?: AdLabel;
  offer?: AdLabel;
  /** Present only when the model judged the copy urgent. */
  urgency?: { probability: number };
  model: string;
  labeledAt: string;
}

export interface Tracker {
  id: string;
  shopId: string;
  createdAt: string;
}
