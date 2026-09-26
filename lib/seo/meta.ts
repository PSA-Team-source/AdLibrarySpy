import type { Metadata } from 'next';
import { cache } from 'react';
import { SITE_URL } from '@/lib/public/site';
import { directoryList, MIN_SHOPS, PAGE_SIZE, type ListSpec } from './directory';

/**
 * One list read per request: generateMetadata and the page both need it, and
 * React's cache() keys on primitive arguments, so the spec travels as JSON.
 */
export const loadList = cache((spec: string, page: number) => directoryList(JSON.parse(spec) as ListSpec, page));

/** Metadata for a public directory page: unique title/description, canonical, OG, and
 *  noindex (follow kept) when the list is thin. */
export function directoryMetadata({ title, description, path, total }: {
  title: string; description: string; path: string; total: number;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: total >= MIN_SHOPS ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: 'website', url, title, description, siteName: 'AdLibrarySpy' },
    twitter: { card: 'summary', title, description },
  };
}

/** "Showing 51–100" for page 2 of a list. */
export function rangeLabel(page: number, shown: number): string {
  const from = (page - 1) * PAGE_SIZE + 1;
  return `${from.toLocaleString('en-US')}–${(from + shown - 1).toLocaleString('en-US')}`;
}

export const pageSuffix = (page: number) => (page > 1 ? ` — page ${page}` : '');
