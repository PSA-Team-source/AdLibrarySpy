import { ArrowRight } from 'lucide-react';
import { REPO_URL } from '@/lib/public/site';

/** GitHub's official mark (github.com/logos); lucide 1.x dropped brand icons. */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12.02C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/**
 * Site-wide open-source strip above the public headers (homepage + (public) layout).
 * Static and cookie-free on purpose: public pages are edge-cached, so a per-viewer
 * "dismissed" state would either vary the cache or flash in after hydration.
 */
export function OpenSourceAnnouncement() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener"
      className="group block bg-[#050807] text-white/85 ring-1 ring-inset ring-white/10 transition-colors hover:text-white"
    >
      <span className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs sm:text-[13px]">
        <GitHubMark className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold text-[#a7f45a]">AdLibrarySpy is open source.</span>
          <span className="hidden sm:inline"> The app, extension, MCP server and CLI are MIT on GitHub.</span> Contributions welcome
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </a>
  );
}
