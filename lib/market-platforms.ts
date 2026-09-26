export const MARKET_PLATFORM_ALL = 'all';
export const MARKET_PLATFORM_OTHER = 'other';

export const STANDARD_MARKET_PLATFORMS = [
  { id: 'shopify', name: 'Shopify', color: 'bg-green-500' },
  { id: 'woocommerce', name: 'WooCommerce', color: 'bg-purple-600' },
  { id: 'shopline', name: 'Shopline', color: 'bg-cyan-500' },
  { id: 'shoplazza', name: 'Shoplazza', color: 'bg-teal-500' },
] as const;

export const MARKET_PLATFORM_FILTERS = [
  { id: MARKET_PLATFORM_ALL, name: 'All Platforms', color: 'bg-gray-500' },
  ...STANDARD_MARKET_PLATFORMS,
  { id: MARKET_PLATFORM_OTHER, name: 'Other', color: 'bg-foreground/30' },
] as const;

export const CREATIVE_PLATFORM_FILTERS = [
  ...STANDARD_MARKET_PLATFORMS.map(({ id, name }) => ({ id, name })),
  { id: MARKET_PLATFORM_OTHER, name: 'Other' },
] as const;
