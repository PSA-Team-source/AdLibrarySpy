// A click on a store link swaps to this at once (Next prefetches it), instead
// of holding the old page while a cold store renders (~200-600ms). Mirrors the
// page's rhythm (breadcrumb, logo + name, cards) so the swap does not shift.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-40 rounded bg-muted" />
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-muted" />
        <div className="h-7 w-56 rounded-lg bg-muted" />
      </div>
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}
