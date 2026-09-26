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

/** Rank pill — top three get a filled badge, the rest plain numerals. */
export function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const shade = rank === 1 ? 'bg-foreground' : rank === 2 ? 'bg-foreground/80' : 'bg-foreground/60';
    return (
      <div className={`w-6 h-6 ${shade} rounded-full flex items-center justify-center text-xs font-bold shadow-lg text-background`}>
        {rank}
      </div>
    );
  }
  return (
    <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-muted-foreground">
      {rank}
    </div>
  );
}
