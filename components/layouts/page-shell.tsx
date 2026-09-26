'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * PageShell — the one dashboard page scaffold.
 *
 * This is the layout `/my-product`, `/customers`, `/orders/all`, `/market/*` and
 * the 11 subscription screens already render by hand; it lives here so any page
 * composes it instead of re-deriving it (and drifting). It used to sit in
 * `app/(dashboard)/subscriptions/_components/sub-page-shell.tsx`, which still
 * re-exports it as `SubPageShell` for the subscription kit.
 *
 * Every screen under `(dashboard)` uses this. `components/ui/page-header.tsx` is
 * NOT an alternative — it is bold 2xl on `--text` tokens and survives only for
 * `(partner)` and `/showcase`, which render outside the dashboard shell.
 *
 * The contract (read from the reference pages + DashboardShell):
 *  - Width: full-bleed. DashboardShell already wraps normal pages in
 *    `mx-4 lg:mx-8 py-6 pb-24`, so a page adds NO horizontal padding and NO
 *    `max-w-*`. (A page that centres on `max-w-7xl` + its own `px-*` both
 *    double-pads and renders visibly narrower than every other screen.)
 *  - Title: `text-3xl font-extralight tracking-tight sm:text-4xl` on a
 *    space-between header bar, actions right. Never `<PageHeader>` (bold 2xl,
 *    `--text` tokens) — no other dashboard list page uses it.
 *  - Detail pages (`variant="detail"`): one step down — `text-2xl font-light
 *    sm:text-3xl` with a round back button, per `/customers/[id]`.
 *  - No breadcrumb. The platform expresses "where am I" with the sidebar's
 *    active item plus a back button, not a crumb line.
 *
 * `fullHeight` mirrors DashboardShell's FULL_HEIGHT_LIST_ROUTES. Those routes are
 * rendered `fixed`/`overflow-hidden` with NO padding wrapper, so the page must
 * supply its own padding and fill the viewport, letting its table scroll
 * internally (see `/my-product`). Keep this flag in sync with that Set.
 */
export function PageShell({
  title,
  description,
  actions,
  backUrl,
  onBack,
  variant = 'list',
  fullHeight = false,
  titleAdornment,
  className,
  children,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  /** Renders the platform back button to the left of the title. */
  backUrl?: string;
  /**
   * Replaces the back button's navigation (e.g. to confirm discarding unsaved
   * edits first). Renders the button even without `backUrl`.
   */
  onBack?: () => void;
  /** 'list' = index screens (3xl extralight); 'detail' = a single record (2xl light). */
  variant?: 'list' | 'detail';
  /** true only for routes in DashboardShell's FULL_HEIGHT_LIST_ROUTES. */
  fullHeight?: boolean;
  /** Badge/status chip rendered inline after the title (e.g. "Live Data"). */
  titleAdornment?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const isDetail = variant === 'detail';


  return (
    <div
      className={cn(
        fullHeight ? 'flex h-full flex-col gap-6 px-4 py-6 lg:px-8' : 'flex flex-col gap-6',
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          {(backUrl || onBack) && (
            <button
              type="button"
              onClick={() => (onBack ? onBack() : backUrl && router.push(backUrl))}
              aria-label="Back"
              className="tap-target -ml-1 shrink-0 rounded-lg bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:-ml-0 lg:h-8 lg:w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className={cn(
                  /* `dash-title` is the stable hook for the brand heading face
                     in app/(dashboard)/dashboard-type.css. It carries no styles
                     of its own — size, weight and tracking stay exactly as they
                     are below — so a page that renders this outside the
                     dashboard scope is unaffected. */
                  'dash-title tracking-tight text-foreground',
                  isDetail
                    ? 'text-2xl font-light sm:text-3xl'
                    : 'text-3xl font-extralight sm:text-4xl',
                )}
              >
                {title}
              </h1>
              {titleAdornment}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {/* `shrink-0` with no wrap meant three header actions on a 390px screen
            pushed each other off the right edge instead of stacking. Wrap them,
            and let them take the full width below `sm` so they line up under the
            title rather than dangling half off-screen. */}
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

export default PageShell;
