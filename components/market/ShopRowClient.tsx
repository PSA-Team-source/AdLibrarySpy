'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { dropCachedShop, invalidateShops } from './shops-cache';
import { EyeOff, Eye, MoreHorizontal } from 'lucide-react';
import { hideShopAction, unhideShopAction } from '@/app/(app)/shops/actions';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * A Shops row's "⋯" menu: "Hide from Shops" (or "Show in Shops again" in the
 * hidden view). The shop name itself is a plain link to the dossier. The
 * button fades in on row hover on pointer devices and is always shown on touch.
 */
export function ShopRowMenu({ shop, hidden = false }: {
  shop: { id: string; name: string; domain: string };
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
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full outline-none transition-opacity hover:bg-[var(--a-fill)] focus-visible:opacity-100 focus-visible:shadow-[0_0_0_4px_var(--a-focus)] disabled:opacity-50 data-[state=open]:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${error ? 'text-[var(--a-red)] !opacity-100' : 'text-muted-foreground'}`}
        title={error || `More actions for ${shop.domain}`}
        aria-label={error || `More actions for ${shop.domain}`}
        disabled={pending}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
        <DropdownMenuItem onSelect={toggleHidden} className="flex items-center gap-2">
          {hidden ? <><Eye className="h-4 w-4" /> Show in Shops again</> : <><EyeOff className="h-4 w-4" /> Hide from Shops</>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
