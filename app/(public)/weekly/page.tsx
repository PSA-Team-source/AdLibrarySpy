import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/public/site';
import { WeeklyReportView, weekPath } from './WeeklyReportView';
import { loadArchive, loadLatest } from './load';

// Anonymous + identical for every visitor → ISR, served from the edge. No cookies.
export const revalidate = 3600;

const DESCRIPTION = 'Every Monday: the Shopify stores scaling their Meta ads, the fastest measured traffic growth, the biggest ad peaks and the newest winners — from real index data. Free.';

export async function generateMetadata(): Promise<Metadata> {
  const report = await loadLatest();
  if (!report) return { title: 'Weekly ecommerce report' };
  const title = `${report.data.weekLabel}: the stores scaling right now`;
  return {
    title: { absolute: `${title} | AdLibrarySpy Weekly` },
    description: DESCRIPTION,
    // /weekly is always the newest issue; the issue's own URL is the canonical one.
    alternates: { canonical: `${SITE_URL}${weekPath(report.week)}` },
    openGraph: { type: 'article', siteName: 'AdLibrarySpy', url: `${SITE_URL}/weekly`, title, description: DESCRIPTION },
    twitter: { card: 'summary_large_image', title, description: DESCRIPTION },
  };
}

export default async function WeeklyLatestPage() {
  const [report, archive] = await Promise.all([loadLatest(), loadArchive()]);
  if (!report) notFound();
  return <WeeklyReportView report={report} archive={archive} />;
}
