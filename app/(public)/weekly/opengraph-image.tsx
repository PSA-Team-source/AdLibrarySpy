import { notFound } from 'next/navigation';
import { OG_SIZE } from '@/lib/public/og';
import { weeklyOgImage } from '@/lib/weekly/og';
import { loadLatest } from './load';

export const alt = 'AdLibrarySpy weekly report: the Shopify stores scaling right now';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function WeeklyLatestOgImage() {
  const report = await loadLatest();
  if (!report) notFound();
  return weeklyOgImage(report);
}
