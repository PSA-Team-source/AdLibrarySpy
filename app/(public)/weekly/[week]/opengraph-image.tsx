import { notFound } from 'next/navigation';
import { OG_SIZE } from '@/lib/public/og';
import { WEEK_RE } from '@/lib/weekly/data';
import { weeklyOgImage } from '@/lib/weekly/og';
import { loadWeek } from '../load';

export const alt = 'AdLibrarySpy weekly report: the week\'s top scaling Shopify stores';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function WeeklyIssueOgImage({ params }: { params: Promise<{ week: string }> }) {
  const week = (await params).week.toLowerCase();
  const report = WEEK_RE.test(week) ? await loadWeek(week) : null;
  if (!report) notFound();
  return weeklyOgImage(report);
}
