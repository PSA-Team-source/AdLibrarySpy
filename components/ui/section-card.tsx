import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * SectionCard — the ONE card surface for subscription screens. Replaces the
 * hand-rolled `rounded-xl border border-border bg-card p-{4,5,6}` variants that
 * had drifted per page (p-5 vs p-6 vs rounded-lg p-4). Fixed rhythm: rounded-xl,
 * `border-border`, `bg-card`, p-6. Optional title/description/actions header.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** false → no inner padding (e.g. a card whose body is a full-bleed table). */
  padded?: boolean;
}) {
  const hasHeader = title || description || actions;
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-6', bodyClassName)}>{children}</div>
    </section>
  );
}

export default SectionCard;
