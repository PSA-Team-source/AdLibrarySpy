import { WinnersDay } from '../day-list';

export const metadata = { title: 'Daily winners' };
export const dynamic = 'force-dynamic';

export default async function WinnersDatePage({ params, searchParams }: { params: Promise<{ date: string }>; searchParams: Promise<{ niche?: string }> }) {
  const [{ date }, { niche }] = await Promise.all([params, searchParams]);
  return <WinnersDay day={date} niche={niche?.trim() || null} />;
}
