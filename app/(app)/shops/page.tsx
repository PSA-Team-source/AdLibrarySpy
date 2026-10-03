import { categoryTree, techFacets } from '@/lib/market/shops';
import { requireCtx } from '@/lib/auth/guard';
import { ShopsExplorer } from '@/components/market/ShopsExplorer';
import { loadShops } from './load';
import { StartHere } from '@/components/home/StartHere';
import { PickThree } from '@/components/home/PickThree';
import { emit } from '@/lib/analytics/events';
import { pickThreeShouldShow } from './pick-three-load';
import { starterNiches, starterShops } from './starters';

export const metadata = { title: 'Shops' };
export const dynamic = 'force-dynamic';

// Renders the first page on the server so it paints with rows; every change
// after that is fetched by ShopsExplorer from /api/shops (same loader).
export default async function ShopsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  // "Start here" / "Picked for you" lives behind a bell in the header (no page height),
  // so it is offered on every view, not only the unfiltered first page.
  const [cats, tech, initial, intro] = await Promise.all([
    categoryTree(), techFacets(), loadShops(ctx, sp),
    // Called directly so an empty result (no live stores) leaves no wrapper behind.
    StartHere({ bell: true }).catch(e => { console.error('[start-here]', e); return null; }),
  ]);
  const pick3 = await pickThreeStep(ctx);

  return (
    <>
    {pick3}
    <ShopsExplorer
      categories={cats}
      tech={tech}
      initial={initial}
      initialParams={sp}
      renderedAt={Date.now()}
      intro={intro}
    />
    </>
  );
}

/** "Pick 3 shops to watch" for new users in the test's treatment arm; null when there is nothing real to offer. */
async function pickThreeStep(ctx: Awaited<ReturnType<typeof requireCtx>>) {
  if (!(await pickThreeShouldShow(ctx))) return null;
  const { favourite, niches } = await starterNiches().catch(() => ({ favourite: null, niches: [] as { id: string; name: string }[] }));
  let active = favourite?.id ?? null;
  let shops = await starterShops(active).catch(() => []);
  if (!shops.length && active) { shops = await starterShops(null).catch(() => []); active = null; }
  if (!shops.length) return null;
  emit('pick3_shown', ctx.user.id, { workspaceId: ctx.workspaceId });
  return <PickThree initial={shops} initialNiche={active} favourite={favourite} niches={niches} />;
}
