'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { dropCachedShop, invalidateShops } from './shops-cache';
import { BarChart3, EyeOff, Eye } from 'lucide-react';
import { hideShopAction, unhideShopAction } from '@/app/(app)/shops/actions';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** The shop name, opening "See shop analytics" / "Hide from Shops". */
export function ShopNameMenu({ shop, label = shop.name, hidden = false }: {
  shop: { id: string; name: string; domain: string; fullTitle?: string };
  /** What the trigger shows; the Shops table shows the domain, as Top Brands does. */
  label?: string;
  hidden?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const toggleHidden = () => start(async () => {
    setError('');
    const input = { id: shop.id, domain: shop.domain, name: shop.name };
    dropCachedShop(qc, shop.id, hidden ? -1 : 1);
    const res = await (hidden ? unhideShopAction(input) : hideShopAction(input)).catch(() => ({ ok: false }));
    void invalidateShops(qc);
    if (!res.ok) { setError('Could not update this shop — try again.'); return; }
    router.refresh();
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="min-w-0 truncate text-left text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        title={error || shop.fullTitle || shop.name}
        disabled={pending}
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/shops/${shop.id}`} className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> See shop analytics
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleHidden} className="flex items-center gap-2">
          {hidden ? <><Eye className="h-4 w-4" /> Show in Shops again</> : <><EyeOff className="h-4 w-4" /> Hide from Shops</>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
