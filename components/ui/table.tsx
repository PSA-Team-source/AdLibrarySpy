import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The dashboard's ONE table recipe.
 *
 * Every data table in the admin — orders, customers, settings, analytics, the
 * tables inside dialogs — renders through these primitives, so a merchant reads
 * one layout everywhere. Before this, 81 files hand-rolled at least eight header
 * treatments (tinted vs plain header rows, `text-sm` vs `text-xs uppercase`,
 * `py-1.5` to `px-6 py-4` cells, three hover strengths).
 *
 * The recipe is the Orders list, the most-used screen:
 *   header row  untinted, hairline bottom border
 *   header cell `p-3`, `text-xs font-medium uppercase tracking-wider`, muted, never wraps
 *   body row    hairline bottom border, `hover:bg-muted`, no border on the last row
 *   body cell   `p-3 text-sm`; a stacked cell is `text-sm font-medium text-foreground`
 *               over `text-xs text-muted-foreground`
 *   numbers     `text-right tabular-nums`
 *
 * The surface around a table is the standard card (`rounded-xl border
 * border-border bg-card`, or `SectionCard padded={false}`); the table itself
 * draws no outer border.
 *
 * The class strings are exported for the rare table that cannot use the
 * components (a virtualised grid, a third-party renderer) — reach for them
 * before writing a new class list.
 */

export const tableHeadClass =
  'whitespace-nowrap p-3 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0';
export const tableRowClass =
  'border-b border-border transition-colors hover:bg-muted data-[state=selected]:bg-muted';
export const tableCellClass = 'p-3 align-middle text-sm [&:has([role=checkbox])]:pr-0';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll container (e.g. `table-sticky-id`, `max-h-[60vh]`). */
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    // `data-table-scroll` (globals.css) gives the horizontal scroll momentum,
    // contained overscroll and — on touch — a visible scrollbar, so a table
    // wider than the phone reads as scrollable instead of truncated.
    <div className={cn('data-table-scroll relative w-full overflow-auto', containerClassName)}>
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-transparent', className)} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn('border-t border-border font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
);
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={cn(tableRowClass, className)} {...props} />
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={cn(tableHeadClass, className)} {...props} />
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn(tableCellClass, className)} {...props} />
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

/** The one empty-table row: a single full-width cell, centred, muted. Render it
 *  only when the list is genuinely empty — never as a stand-in for missing data. */
function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
};
