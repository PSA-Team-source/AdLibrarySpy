// Platform badge — same icon set and mapping as PlatformDTC's market pages.
import ShopifyIcon from '@/components/icon/ShopifyIcon';
import WooCommerceIcon from '@/components/icon/WooCommerceIcon';
import MagentoIcon from '@/components/icon/MagentoIcon';
import SquarespaceIcon from '@/components/icon/SquarespaceIcon';
import WixIcon from '@/components/icon/WixIcon';
import ShoplazzaIcon from '@/components/icon/ShoplazzaIcon';
import ShoplineIcon from '@/components/icon/ShoplineIcon';

export function PlatformIcon({ platform, className = 'w-4 h-4' }: { platform: string; className?: string }) {
  switch ((platform || '').toLowerCase()) {
    case 'shopify':      return <ShopifyIcon className={className} />;
    case 'woocommerce':  return <WooCommerceIcon className={className} />;
    case 'magento':      return <MagentoIcon className={className} />;
    case 'wix':          return <WixIcon className={className} />;
    case 'squarespace':  return <SquarespaceIcon className={className} />;
    case 'shoplazza':    return <ShoplazzaIcon className={className} />;
    case 'shopline':     return <ShoplineIcon className={className} />;
    default:             return null;
  }
}

/** Rank — top three get a filled capsule, the rest plain numerals. */
export function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const shade = rank === 1 ? 'bg-foreground' : rank === 2 ? 'bg-foreground/75' : 'bg-foreground/55';
    return (
      <div className={`h-6 min-w-6 ${shade} inline-flex items-center justify-center rounded-full px-1.5 text-[13px] font-semibold tabular-nums text-background`}>
        {rank}
      </div>
    );
  }
  return (
    <div className="inline-flex h-6 min-w-6 items-center justify-center text-[13px] font-medium tabular-nums text-muted-foreground">
      {rank}
    </div>
  );
}
