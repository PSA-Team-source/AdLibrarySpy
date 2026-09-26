import type { Shop } from '@/lib/types';
import { compact } from '@/lib/format';
import { trafficCaption, trafficTitle } from '@/lib/traffic/similarweb';

/**
 * A store's visit figure with the source it came from — SimilarWeb's
 * measurement of that exact host, or the market index's own estimate where the
 * crawl has not reached the store yet. The label is not optional: the two are
 * different measurements and a bare number would mix them silently.
 *
 * A store with no figure at all renders nothing, not a dash or a zero.
 */
export function ShopVisits({ shop }: { shop: Shop }) {
  if (!(shop.monthlyVisits > 0)) return null;
  const period = shop.similarweb?.period ?? '';
  return (
    <span className="shrink-0 text-right"
      title={trafficTitle(shop.monthlyVisits, shop.trafficSource, period, shop.domain)}>
      <span className="block text-sm tabular-nums text-foreground">{compact(shop.monthlyVisits)} visits</span>
      <span className="block text-[10px] leading-tight text-muted-foreground">
        {trafficCaption(shop.trafficSource, period)}
      </span>
    </span>
  );
}
