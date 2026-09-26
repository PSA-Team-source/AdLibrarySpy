import type { ReactNode } from 'react';
import { AdsNavProvider } from '@/components/market/AdClient';

/**
 * The ads library opens an ad as a right-hand drawer over the grid: `drawer` is
 * a parallel slot, and @drawer/(.)[id] intercepts client navigation to
 * /ads/[id]. A direct visit or reload of /ads/[id] renders the full page.
 */
export default function AdsLayout({ children, drawer }: { children: ReactNode; drawer: ReactNode }) {
  return <AdsNavProvider>{children}{drawer}</AdsNavProvider>;
}
