// Shape of weekly_reports.data, written by scripts/weekly-report.mjs.
// Every figure is copied from the market index at generation time together
// with where it came from; nothing here is modelled or estimated by us.

export interface WeeklyItem {
  domain: string;
  name: string;
  /** https logo URL from the index, or '' (rendered as nothing). */
  logo: string;
  country: string;
  niche: string;
  /** The headline figure, already formatted ("+156%", "14.2K ads"). */
  metric: string;
  /** Raw value behind `metric`, for sorting/OG. */
  value: number;
  /** One line of context with the figures it rests on. */
  detail: string;
}

export interface WeeklySection {
  key: 'scaling' | 'growth' | 'ad-peaks' | 'newest' | 'niches';
  title: string;
  blurb: string;
  /** Where the headline metric comes from and which period it covers. */
  source: string;
  items: WeeklyItem[];
}

export interface WeeklyProduct {
  title: string;
  /** Major units; 0 = the index has no price (then no price is shown). */
  price: number;
  currency: string;
  image: string;
  domain: string;
  storeName: string;
}

export interface WeeklyReportData {
  week: string;            // 2026-w40
  weekLabel: string;       // Week 40, 2026
  weekStart: string;       // 2026-09-28 (Monday)
  weekEnd: string;         // 2026-10-04
  generatedAt: string;     // ISO timestamp
  indexMonth: string;      // index snapshot month, 2026-09
  trafficPeriod: string;   // SimilarWeb measured month, 2026-08
  sections: WeeklySection[];
  products: WeeklyProduct[];
  /** Ready-to-post X thread (not posted automatically). */
  x_thread: string[];
}

export interface WeeklyReport {
  week: string;
  publishedAt: string;
  data: WeeklyReportData;
}
