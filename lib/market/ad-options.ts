// Ads library options shared by the server query (creatives.ts) and the client
// toolbar. Kept free of server imports so the toolbar bundle stays client-safe.

/** EU member states + the UK, the markets Meta's EU ad transparency rules cover. */
export const EU_UK_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB'] as const;
/**
 * Sorts the index can really order by. "relevance" is text relevance when there
 * is a search and the index's own order otherwise.
 */
export const AD_SORTS = {
  relevance: { label: 'Relevance' },
  newest: { label: 'Newest', sortBy: 'start_at', sortOrder: 'desc' },
  longest: { label: 'Longest running', sortBy: 'start_at', sortOrder: 'asc' },
  active: { label: 'Most active ads', sortBy: 'ads_running_num', sortOrder: 'desc' },
} as const;
export type AdSort = keyof typeof AD_SORTS;
export function isAdSort(v: string | undefined): v is AdSort { return !!v && v in AD_SORTS; }
