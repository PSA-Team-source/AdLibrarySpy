// "Start here": live stores adding the most Meta ads right now, in the category
// the user already likes (from the stores they opened) or any category they tap.
// Real data only: no stores → no block.
import { starterNiches, starterShops } from '@/app/(app)/shops/starters';
import { PicksBell, StartHereList } from './StartHereList';

/** `bell` = behind a header icon (Shops); otherwise the inline list (Home). */
export async function StartHere({ bell = false }: { bell?: boolean } = {}) {
  const { favourite, niches } = await starterNiches().catch(e => { console.error('[start-here] niches', e); return { favourite: null, niches: [] }; });
  const t0 = Date.now();
  let shops = await starterShops(favourite?.id ?? null).catch(e => { console.error('[start-here] shops', e); return []; });
  console.log('[start-here]', favourite?.name ?? '-', shops.length, Date.now() - t0, 'ms');
  let active = favourite?.id ?? null;
  if (!shops.length && favourite) { shops = await starterShops(null).catch(() => []); active = null; }
  if (!shops.length) return null;
  const props = { initial: shops, initialNiche: active, favourite, niches };
  return bell ? <PicksBell {...props} /> : <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><StartHereList {...props} /></section>;
}
