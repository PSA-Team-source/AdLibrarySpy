import { AdDrawerShell } from '@/components/market/AdClient';

// The click opens the drawer at once over the grid (Next prefetches this),
// instead of the app-wide skeleton replacing the whole /ads page until the
// ad's data arrives.
export default function Loading() {
  return (
    <AdDrawerShell>
      <div className="flex animate-pulse flex-col gap-4 p-6" aria-busy="true" aria-label="Loading">
        <div className="h-6 w-56 rounded-lg bg-muted" />
        <div className="h-80 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
      </div>
    </AdDrawerShell>
  );
}
