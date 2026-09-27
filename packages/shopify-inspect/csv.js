export const CSV_COLUMNS = [
  'domain', 'name', 'shopify', 'theme', 'currency', 'locale',
  'productCount', 'priceMin', 'priceMax', 'visits', 'visitsSource',
  'liveMetaAds', 'niche', 'pixels', 'apps',
];

export const csvCell = value => {
  const s = Array.isArray(value) ? value.join(';') : String(value ?? '');
  return `"${s.replaceAll('"', '""')}"`;
};

export function csvRow(s) {
  const values = {
    domain: s.domain,
    name: s.name,
    shopify: s.shopify,
    theme: s.theme,
    currency: s.currency,
    locale: s.locale,
    productCount: s.productCount,
    priceMin: s.prices?.min,
    priceMax: s.prices?.max,
    visits: s.index?.traffic?.visits,
    visitsSource: s.index?.traffic?.sourceLabel,
    liveMetaAds: s.index?.metaAds?.live,
    niche: s.index?.niche,
    pixels: s.pixels,
    apps: s.apps,
  };

  return CSV_COLUMNS.map(key => csvCell(values[key])).join(',');
}