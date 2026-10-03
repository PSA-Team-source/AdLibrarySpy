import { WinnersDay } from './day-list';

export const metadata = { title: 'Daily winners' };
export const dynamic = 'force-dynamic';

export default async function WinnersPage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const { niche } = await searchParams;
  return <WinnersDay day={null} niche={niche?.trim() || null} />;
}
