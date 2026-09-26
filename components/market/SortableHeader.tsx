'use client';
import { useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';
import { useGo } from '@/components/market/MarketToolbar';

/**
 * A sortable column header. Clicking sorts descending (the useful direction for
 * every metric here); clicking the active column again flips to ascending.
 *
 * It also clears `view`, because a segment sets its own sort — leaving it in
 * place made a header click appear to do nothing at all.
 *
 * Renders the whole `<th>` with PlatformDTC's `SortableTableHead` recipe
 * (components/ui/sortable-table-head.tsx): the button carries the header cell's
 * own `p-3` box and type scale so sortable and plain headers line up, and the
 * caret only shows on the active column (or on hover).
 */
export function SortableHeader({ label, sortKey, isDefault = false, hint, align = 'left', className }: {
  label: string; sortKey: string; isDefault?: boolean; hint?: string;
  align?: 'left' | 'right'; className?: string;
}) {
  // Inside ShallowUrlProvider (Shops) a sort is a pushState and the explorer
  // refetches; elsewhere it is a normal route navigation.
  const navigate = useGo();
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const explicitKey = params.get('sort');
  const hasSegment = !!params.get('view');
  // With no explicit sort and no segment the table is on its default column, so
  // that header shows as active even though nothing is in the URL.
  const activeKey = explicitKey ?? (hasSegment ? null : (isDefault ? sortKey : null));
  const activeDir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const isActive = activeKey === sortKey;
  const nextDir = isActive && activeDir === 'desc' ? 'asc' : 'desc';

  function go() {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set('sort', sortKey);
    if (nextDir === 'asc') p.set('dir', 'asc'); else p.delete('dir');
    p.delete('view');    // a segment would otherwise override this sort
    p.delete('page');
    start(() => navigate(`${pathname}?${p.toString()}`));
  }

  const Icon = !isActive ? ChevronsUpDown : activeDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      scope="col"
      aria-sort={isActive ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('p-0', className)}
    >
      <button
        type="button"
        onClick={go}
        disabled={pending}
        title={`${hint ? hint + ' — ' : ''}sort ${nextDir === 'asc' ? 'lowest' : 'highest'} first`}
        className={cn(
          'group inline-flex w-full items-center gap-1.5 whitespace-nowrap p-3 text-xs font-medium uppercase tracking-wider transition-colors',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          align === 'right' && 'justify-end',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span>{label}</span>
        <Icon
          aria-hidden
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-opacity',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60',
          )}
        />
      </button>
    </TableHead>
  );
}
