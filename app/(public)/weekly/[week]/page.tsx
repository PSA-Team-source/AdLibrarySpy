import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/public/site';
import { WEEK_RE } from '@/lib/weekly/data';
import { WeeklyReportView, weekPath } from '../WeeklyReportView';
import { loadArchive, loadWeek } from '../load';

// Anonymous + identical for every visitor → ISR, served from the edge. No cookies.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }   // render on first request, then cache

type Params = Promise<{ week: string }>;

async function load(raw: string) {
  const week = raw.toLowerCase();
  if (!WEEK_RE.test(week)) notFound();
  const report = await loadWeek(week);
  if (!report) notFound();
  return report;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const report = await load((await params).week);
  const d = report.data;
  const title = `${d.weekLabel}: the stores scaling right now`;
  const lead = d.sections.find(s => s.key === 'scaling')?.items.slice(0, 3).map(i => i.name) ?? [];
  const description = `${lead.length ? `${lead.join(', ')} and more: ` : ''}the Shopify stores scaling Meta ads, fastest measured traffic growth, biggest ad peaks and newest winners for ${d.weekLabel}.`;
  const url = `${SITE_URL}${weekPath(report.week)}`;
  return {
    title: { absolute: `${title} | AdLibrarySpy Weekly` },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', siteName: 'AdLibrarySpy', url, title, description, publishedTime: report.publishedAt },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function WeeklyIssuePage({ params }: { params: Params }) {
  const [report, archive] = await Promise.all([load((await params).week), loadArchive()]);
  return <WeeklyReportView report={report} archive={archive} />;
}
