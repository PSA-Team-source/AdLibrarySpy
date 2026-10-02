'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import {
  ChevronDown, ChevronRight, Coffee, Home, LogOut, Menu, MessageSquare, Moon, Search, Settings, Sun, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { markAppNavigation } from '@/lib/app-history';
import { logoutAction } from '@/lib/auth/actions';
import { APP_NAV, SETTINGS_NAV, isNavActive, type NavItem } from '@/lib/navigation';
import { BrandMark } from '@/components/brand/brand-mark';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { AgentSkillAnnouncement } from '@/components/AgentSkillAnnouncement';
import { GitHubMark } from '@/components/public/OpenSourceAnnouncement';
import { REPO_URL } from '@/lib/public/site';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * AppShell — the signed-in app chrome (same layout as the PlatformDTC dashboard).
 *
 * Measurements:
 *  - a fixed top bar `--app-chrome-top` tall (52px phone / 44px lg) carrying the
 *    AdLibrarySpy ink+lime artwork and lockup, scoped `.dark` so it reads the same in both themes;
 *  - a floating 220px rounded-2xl sidebar on `--chrome-bg`, `nav-row` items,
 *    faint section labels, a sticky bottom slot;
 *  - a scroll pane inset `lg:ml-[220px]` (a media query, not JS state, so the
 *    first paint on a phone is already right) with `mx-4 lg:mx-8 py-6 pb-24`;
 *  - FULL_HEIGHT_ROUTES render with no padding wrapper, and the page supplies
 *    its own padding. At lg the pane is overflow-hidden and the page fills it
 *    (`lg:h-full`, table scrolls inside); on a phone the pane scrolls like any
 *    other route — a viewport-locked list left the results a 0-2 row sliver
 *    under the toolbar (/ads showed no ads at all);
 *  - ⌘K command palette over the same nav map as the sidebar.
 */

// Keep in sync with the pages that render `PageShell fullHeight`.
const FULL_HEIGHT_ROUTES = new Set(['/shops', '/ads', '/products', '/landing-pages']);

// Hover/touch upgrades the nav link to a FULL prefetch, so the screen's data is
// already on its way from us-east-1 when the click lands (PlatformDTC does the
// same with route-warm). Supported by the App Router Link at runtime
// (next/dist/client/app-dir/link.js); the public next/link types are the Pages
// Router ones and do not declare it yet, hence the untyped spread.
const WARM_ON_HOVER = { unstable_dynamicOnHover: true } as object;

export interface AppShellProps {
  user: { name: string; email: string };
  workspace: { id: string; name: string; role: string };
  /** Every workspace the user belongs to; more than one shows the switcher. */
  workspaces?: { id: string; name: string }[];
  trackers: number;
  /** False once the user dismissed the agent-skill announcement (cookie read by the layout). */
  skillAnnouncement?: boolean;
  /** GitHub Sponsors page once it is live (lib/public/sponsor.ts); null = no Donate link. */
  donateUrl?: string | null;
  children: React.ReactNode;
}

/**
 * The switch route changes state, so it is POST-only. The form is built on
 * <body> rather than inside the menu, which unmounts as the item is selected
 * and would cancel a submission from within it.
 */
function switchWorkspace(to: string, next: string) {
  const form = Object.assign(document.createElement('form'), { method: 'post', action: '/api/workspace/switch' });
  for (const [name, value] of Object.entries({ to, next })) {
    form.append(Object.assign(document.createElement('input'), { type: 'hidden', name, value }));
  }
  document.body.append(form);
  form.submit();
}

export function AppShell({ user, workspace, workspaces = [], trackers, skillAnnouncement = true, donateUrl = null, children }: AppShellProps) {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Route change closes the drawer.
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const firstPath = useRef(pathname);
  useEffect(() => { if (pathname !== firstPath.current) markAppNavigation(); }, [pathname]);

  // Home › Recents: a shop or ad dossier on screen (page or intercepted drawer)
  // is one view. Fired from the shell so every route that renders a dossier is
  // covered; /api/views resolves the name and logo. Fire-and-forget.
  useEffect(() => {
    const m = /^\/(shops|ads)\/([A-Za-z0-9_.:-]{1,128})$/.exec(pathname);
    if (!m) return;
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: m[1] === 'shops' ? 'shop' : 'ad', id: m[2] }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.classList.add('app-scroll-locked');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('app-scroll-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const isFullHeight = FULL_HEIGHT_ROUTES.has(pathname);
  const sidebar = <SidebarInner pathname={pathname} trackers={trackers} user={user} onFeedback={() => setFeedbackOpen(true)} donateUrl={donateUrl} />;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      {/* Background shield: blocks page content from bleeding into the header gap. */}
      <div className="fixed left-0 right-0 top-0 z-[19] bg-[var(--chrome-bg)]" style={{ height: 'var(--app-chrome-top)' }} />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[20] bg-black/50 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppHeader
        user={user}
        workspace={workspace}
        workspaces={workspaces}
        onMobileMenu={() => setMobileOpen(true)}
        onOpenCommand={() => setCommandOpen(true)}
        onFeedback={() => setFeedbackOpen(true)}
        donateUrl={donateUrl}
      />

      {/* Mobile drawer */}
      <aside
        aria-label="Main navigation"
        inert={!mobileOpen}
        className={cn(
          'fixed left-[14px] flex flex-col lg:hidden',
          'app-sidebar app-scroll bg-[var(--chrome-bg)]',
          'overflow-hidden rounded-2xl transition-transform duration-300 ease-out',
          'w-[min(82vw,300px)]',
          mobileOpen ? 'sidebar-visible z-[22] shadow-2xl' : 'sidebar-hidden z-[19]',
        )}
        style={{ top: 'var(--app-chrome-top)', bottom: 'var(--app-safe-bottom)' }}
      >
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="app-sidebar fixed z-[21] hidden w-[220px] flex-col overflow-hidden rounded-2xl bg-[var(--chrome-bg)] lg:flex"
        style={{ left: 0, top: 'var(--app-chrome-top)', bottom: 0 }}
      >
        {sidebar}
      </aside>

      {/* One stable position for {children}; only the wrapper's classes change. */}
      <div
        className={cn(
          'app-content-pane ml-0 overflow-y-auto transition-all duration-300 lg:ml-[220px]',
          isFullHeight && 'lg:overflow-hidden',
        )}
        style={{ marginTop: 'var(--app-chrome-top)', height: 'calc(100dvh - var(--app-chrome-top))' }}
      >
        {isFullHeight ? children : <div className="app-content-inner mx-4 py-6 pb-24 lg:mx-8">{skillAnnouncement && pathname === '/home' && <AgentSkillAnnouncement />}{children}</div>}
      </div>

      <CommandSearch open={commandOpen} onOpenChange={setCommandOpen} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <NavIdlePrefetch />
    </div>
  );
}

// --- Idle warming ------------------------------------------------------------

/**
 * Warms every sidebar screen once the browser is idle, so the FIRST click on any
 * of them is served from the Client Router Cache with no network (PlatformDTC:
 * components/layouts/nav-idle-prefetch.tsx). Measured before this, from prod:
 * each un-warmed click sat on the skeleton 450-730ms while us-east-1 rendered.
 *
 * FULL, not the default prefetch: every (app) screen is force-dynamic, and a
 * default prefetch of a dynamic route caches only the loading.tsx skeleton.
 * FULL entries live `staleTimes.static` (next.config.mjs); mutations still purge
 * them (revalidatePath / router.refresh). Staggered, skipped under Save-Data or
 * 2g.
 *
 * Re-runs on every route change: /ads renders an interception slot (@drawer), so
 * Next keys its entry by the page it was prefetched FROM — a warm made on /home
 * misses a click from /shops. Next dedupes fresh entries, so a re-run only goes
 * to the network for what is actually cold.
 */
function NavIdlePrefetch() {
  const router = useRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return;
    const hrefs = [...new Set(APP_NAV.flatMap((g) => g.items.map((it) => it.href)))].filter((h) => h !== pathname);
    const timers: number[] = [];
    const start = () => hrefs.forEach((href, i) => {
      timers.push(window.setTimeout(() => {
        try { routerRef.current.prefetch(href, { kind: PrefetchKind.FULL }); } catch { /* best effort */ }
      }, i * 150));
    });
    const idle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(start, { timeout: 2000 })
      : window.setTimeout(start, 500);
    // Keep them warm: a screen left open longer than staleTimes.static used to make
    // every next click cold again. Next skips fresh entries, so this only refetches
    // what expired. ponytail: up to one 5-min window per expiry can still be cold.
    const rewarm = window.setInterval(() => { if (document.visibilityState === 'visible') start(); }, 5 * 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') start(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(rewarm);
      document.removeEventListener('visibilitychange', onVisible);
      timers.forEach((t) => window.clearTimeout(t));
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [pathname]);

  return null;
}

// --- Sidebar ---------------------------------------------------------------

const rowClass = (active: boolean) => cn(
  'nav-row flex items-center gap-2 rounded-md px-3 py-1.5 cursor-pointer',
  active
    ? 'bg-accent text-accent-foreground font-medium'
    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
);

const countPill = 'min-w-[20px] rounded-full bg-muted px-2 py-0.5 text-center text-xs font-medium text-muted-foreground';

function NavLink({ it, pathname, trackers, nested = false }: {
  it: NavItem; pathname: string; trackers: number; nested?: boolean;
}) {
  const Icon = it.icon;
  return (
    <li>
      <Link href={it.href} {...WARM_ON_HOVER} className={cn(rowClass(isNavActive(pathname, it.href)), nested && 'pl-7')} role="menuitem">
        <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
          <Icon className={nested ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
        </span>
        <span className="flex-1 overflow-hidden whitespace-nowrap text-sm leading-snug">{it.label}</span>
        {it.badge && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{it.badge}</span>
        )}
        {it.href === '/brandtracker' && trackers > 0 && (
          <span className={countPill}>{trackers}</span>
        )}
      </Link>
    </li>
  );
}

function SidebarInner({
  pathname, trackers, user, onFeedback, donateUrl,
}: {
  pathname: string;
  trackers: number;
  user: { name: string; email: string };
  onFeedback: () => void;
  donateUrl: string | null;
}) {
  // Expandable groups (Favorites, Team) start collapsed, except the one holding
  // the current screen, so the active row is never hidden. A click overrides.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const displayName = user.name || user.email;

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-3 pt-4">
      {APP_NAV.map((group, i) => {
        const GroupIcon = group.icon;
        const key = group.section ?? String(i);
        const open = !GroupIcon || (expanded[key] ?? group.items.some((it) => isNavActive(pathname, it.href)));
        return (
          <div key={key} className="shrink-0">
            {GroupIcon ? (
              <div className="px-2 pb-0.5">
                <button
                  type="button"
                  onClick={() => setExpanded((c) => ({ ...c, [key]: !open }))}
                  aria-expanded={open}
                  className={rowClass(false) + ' w-full'}
                >
                  <GroupIcon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="flex-1 text-left text-sm leading-snug">{group.section}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
                </button>
              </div>
            ) : group.section && (
              <div className="px-3 pb-1 pt-2">
                <span className="text-xs text-muted-foreground/50">{group.section}</span>
              </div>
            )}
            {open && (
              <nav className="px-2 pb-1">
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((it) => (
                    <NavLink key={it.href} it={it} pathname={pathname} trackers={trackers} nested={!!GroupIcon} />
                  ))}
                </ul>
              </nav>
            )}
          </div>
        );
      })}

      <div className="flex-1" />

      <div className="shrink-0 px-2 pb-1">
        <ul className="flex flex-col gap-0.5">
          <li>
            <button type="button" onClick={onFeedback} className={rowClass(false) + ' w-full'}>
              <MessageSquare className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="flex-1 text-left text-sm leading-snug">Feedback</span>
            </button>
          </li>
          <li>
            <a href={REPO_URL} target="_blank" rel="noopener" className={rowClass(false)}>
              <GitHubMark className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="flex-1 text-sm leading-snug">GitHub</span>
            </a>
          </li>
          {donateUrl && (
            <li>
              <a href={donateUrl} target="_blank" rel="noopener" className={rowClass(false)}>
                <Coffee className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="flex-1 text-sm leading-snug">Buy me a coffee</span>
              </a>
            </li>
          )}
        </ul>
      </div>

      <div className="sticky bottom-0 shrink-0 border-t border-[var(--border-subtle)] bg-[var(--chrome-bg)] px-2 py-2">
        <Link
          href="/settings/account"
          className={cn(rowClass(pathname.startsWith('/settings')), 'py-2')}
          role="menuitem"
          title="Settings"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-medium text-white">
            {displayName.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
            {user.name && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
          </span>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}

// --- Header ----------------------------------------------------------------

function AppHeader({
  user, workspace, workspaces, onMobileMenu, onOpenCommand, onFeedback, donateUrl,
}: {
  user: { name: string; email: string };
  workspace: { id: string; name: string };
  workspaces: { id: string; name: string }[];
  onMobileMenu: () => void;
  onOpenCommand: () => void;
  onFeedback: () => void;
  donateUrl: string | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';
  const displayName = user.name || user.email;
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <header
      // The artwork is dark in both themes, so the subtree reads dark tokens.
      // Menus portal to <body> and keep the page theme.
      className="dark fixed z-30 flex items-center bg-[var(--chrome-bg)] pr-2 backdrop-blur-[5px] sm:pr-4"
      style={{ top: 0, left: 0, right: 0, height: 'var(--app-chrome-top)', paddingTop: 'var(--app-safe-top)' }}
    >
      {/* AdLibrarySpy's own top-bar artwork instead of PlatformDTC's steel image:
          the homepage's ink ground with its lime glow, drawn in CSS so there is
          no image request above the fold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(60% 180% at 18% 0%, rgba(167,244,90,.20), transparent 60%)',
            'radial-gradient(40% 160% at 72% 100%, rgba(88,177,39,.14), transparent 65%)',
            'linear-gradient(180deg, #0b100c 0%, #050807 100%)',
          ].join(','),
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[rgba(167,244,90,.18)]" />

      <div className="relative z-10 flex w-full items-center justify-between">
        {/* Left: mirrors the sidebar's column (pl-2 = nav px-2, px-3 = item px-3). */}
        <div className="flex shrink-0 pl-2 lg:w-[220px]">
          <div className="flex items-center gap-2 px-3">
            <button
              type="button"
              onClick={onMobileMenu}
              aria-label="Open menu"
              className="tap-target -ml-2 rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/home" className="tap-target gap-2 rounded-md transition-opacity hover:opacity-80" aria-label="AdLibrarySpy home">
              <BrandMark size={24} />
              <span className="hidden text-[15px] font-semibold tracking-[-0.02em] text-white sm:inline">AdLibrarySpy</span>
            </Link>
            <span aria-hidden className="hidden text-[var(--text-muted)]/60 sm:inline">/</span>

            {/* Workspace switcher position — PlatformDTC's store selector. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="tap-target min-h-[44px] max-w-[150px] justify-start gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-[var(--text)] outline-none transition-colors hover:bg-[var(--surface-hover)] lg:min-h-0 2xl:max-w-[260px]">
                  {/* Capped so a long name ("Jane's workspace") never runs under the centred search. */}
                  <span className="min-w-0 truncate">{workspace.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                  Workspace
                </DropdownMenuLabel>
                <DropdownMenuItem className="flex cursor-default items-center gap-2 bg-accent font-medium text-accent-foreground">
                  <span className="truncate">{workspace.name}</span>
                </DropdownMenuItem>
                {/* Other workspaces (e.g. a team you were invited to): a full
                    navigation through the switch route, so every cached view
                    reloads under the new workspace. */}
                {workspaces.filter(w => w.id !== workspace.id).map(w => (
                  <DropdownMenuItem key={w.id} onSelect={() => switchWorkspace(w.id, '/home')}
                    className="flex cursor-pointer items-center gap-2">
                    <span className="truncate">{w.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/workspace" className="flex cursor-pointer items-center gap-2">
                    <Settings className="h-3.5 w-3.5" /> Rename workspace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/members" className="flex cursor-pointer items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Members
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Center search, absolutely centred so left/right widths don't move it. */}
        <div className="absolute left-1/2 hidden w-full max-w-xl -translate-x-1/2 items-center gap-2 px-4 sm:flex">
          <Link href="/" className="tap-target rounded-lg transition-colors hover:bg-[var(--surface-hover)]" title="Go to home">
            <Home className="h-4 w-4 text-[var(--text-muted)]" />
          </Link>
          <button
            onClick={onOpenCommand}
            className="group flex min-h-[40px] max-w-xl flex-1 items-center rounded-full bg-muted transition-colors duration-150 hover:bg-accent dark:bg-black/80 dark:hover:bg-black/90 lg:min-h-0"
          >
            <div className="pl-3 pr-2 sm:pl-4 sm:pr-3">
              <Search className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text)]" />
            </div>
            <span className="flex-1 py-1.5 text-left text-sm text-[var(--text-muted)]">Search...</span>
            <kbd className="mr-3 hidden rounded border border-[var(--border)] bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs text-[var(--text-muted)] sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-0.5 sm:gap-1 lg:w-[220px] lg:justify-end">
          <button
            type="button"
            onClick={onOpenCommand}
            aria-label="Search"
            className="tap-target rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)] sm:hidden"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="tap-target rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="tap-target min-h-[44px] gap-1.5 rounded-lg px-1.5 py-1 outline-none transition-all duration-200 hover:bg-[var(--surface-hover)] sm:gap-2 sm:px-2 lg:min-h-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-medium text-white">
                  {initial}
                </div>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-[var(--text)] sm:block">{displayName}</span>
                <ChevronDown className="hidden h-3 w-3 text-[var(--text-muted)] sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/account" className="flex cursor-pointer items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/account" className="flex cursor-pointer items-center gap-2">
                  <Settings className="h-3.5 w-3.5" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onFeedback} className="flex cursor-pointer items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" /> Send feedback
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={REPO_URL} target="_blank" rel="noopener" className="flex cursor-pointer items-center gap-2">
                  <GitHubMark className="h-3.5 w-3.5" /> GitHub
                </a>
              </DropdownMenuItem>
              {donateUrl && (
                <DropdownMenuItem asChild>
                  <a href={donateUrl} target="_blank" rel="noopener" className="flex cursor-pointer items-center gap-2">
                    <Coffee className="h-3.5 w-3.5" /> Buy me a coffee
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {/* A server action, so sign-out works before hydration too. */}
              <form action={logoutAction}>
                <DropdownMenuItem asChild className="cursor-pointer text-red-400 focus:text-red-400">
                  <button type="submit" className="flex w-full items-center">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Log out {user.email ? `@${user.email.split('@')[0]}` : ''}
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// --- ⌘K command search -----------------------------------------------------

function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => { if (!open) setValue(''); }, [open]);

  const go = useCallback((href: string) => {
    onOpenChange(false);
    router.push(href);
  }, [onOpenChange, router]);

  if (!open) return null;

  const itemClass = 'cursor-pointer rounded-lg p-3 transition-colors data-[selected=true]:bg-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl shadow-black/50 backdrop-blur-xl">
        <Command shouldFilter label="Search anything">
          <div className="flex items-center border-b border-border p-4">
            <Search className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <Command.Input
              value={value}
              onValueChange={setValue}
              placeholder="Search anything..."
              className="flex-1 bg-transparent text-lg text-foreground placeholder-muted-foreground focus:outline-none"
              autoFocus
            />
            <kbd className="ml-3 rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">ESC</kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-4">
            {value ? (
              <>
                <Command.Empty className="py-8 text-center text-muted-foreground">No results found.</Command.Empty>
                <Command.Group heading="Pages">
                  {APP_NAV.flatMap((g) => g.items.map((it) => (
                    <Command.Item
                      key={it.href}
                      value={`${it.label} ${it.description} ${g.section ?? ''}`}
                      onSelect={() => go(it.href)}
                      className={itemClass}
                    >
                      <div className="font-medium text-foreground">
                        {g.icon && g.section ? `${g.section} · ${it.label}` : it.label}
                      </div>
                      <div className="text-sm text-muted-foreground">{it.description}</div>
                    </Command.Item>
                  )))}
                </Command.Group>
                <Command.Group heading="Settings">
                  {SETTINGS_NAV.map((it) => (
                    <Command.Item
                      key={it.href}
                      value={`${it.label} ${it.description} settings`}
                      onSelect={() => go(it.href)}
                      className={itemClass}
                    >
                      <div className="font-medium text-foreground">{it.label}</div>
                      <div className="text-sm text-muted-foreground">{it.description}</div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            ) : (
              <div className="py-8 text-center">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <div className="text-muted-foreground">Start typing to search...</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Try searching for &quot;shops&quot;, &quot;ads&quot;, or &quot;billing&quot;
                </div>
              </div>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border p-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5">&#8593;</kbd>
                <kbd className="rounded bg-muted px-1.5 py-0.5">&#8595;</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5">&#8629;</kbd>
                <span>to select</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5">ESC</kbd>
              <span>to close</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
