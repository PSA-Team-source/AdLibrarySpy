// Every page under this group requires a signed-in user with a workspace.
// requireCtx() redirects to /login when there is no valid session.
import { AppShell } from '@/components/layouts/app-shell';
import { requireCtx, userWorkspaces } from '@/lib/auth/guard';
import { trackerCount } from '@/lib/data';
import { one } from '@/lib/db';
import { MetaPixel } from '@/components/public/MetaPixel';
import { cookies, headers } from 'next/headers';
import { markActiveDay } from '@/lib/active-days';
import { PATH_HEADER } from '@/lib/auth/safe-next';
import { REPO_URL, SKILL_DISMISS_COOKIE } from '@/lib/public/site';
import { sponsorUrl } from '@/lib/public/sponsor';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FilterMemory } from '@/components/market/FilterMemory';

// Behind a login: never indexed (the public directory lives in the (public) group).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  // Retention: the day this user came in (fire-and-forget, once a day; lib/active-days.ts).
  markActiveDay(ctx.user.id, ctx.workspaceId, (await headers()).get(PATH_HEADER));
  const [trackers, workspaces, fresh, jar, donateUrl, bannerDismissed] = await Promise.all([
    trackerCount(ctx.workspaceId).catch(() => 0),
    userWorkspaces(ctx.user.id).catch(() => []),
    // Account under an hour old = the ad pixel's CompleteRegistration (sent once, see MetaPixel).
    one<{ fresh: boolean }>(`SELECT created_at > now() - interval '1 hour' AS fresh FROM users WHERE id = $1`, [ctx.user.id])
      .then(r => !!r?.fresh, () => false),
    cookies(),
    sponsorUrl(REPO_URL),
    one<{ d: boolean }>('SELECT skill_banner_dismissed_at IS NOT NULL AS d FROM users WHERE id = $1', [ctx.user.id])
      .then(r => !!r?.d, () => false),
  ]);

  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      workspace={{ id: ctx.workspaceId, name: ctx.workspaceName, role: ctx.role }}
      workspaces={workspaces}
      trackers={trackers}
      skillAnnouncement={!bannerDismissed && !jar.has(SKILL_DISMISS_COOKIE)}
      donateUrl={donateUrl}
    >
      <MetaPixel registeredUserId={fresh ? ctx.user.id : null} email={fresh ? ctx.user.email : null} />
      <Suspense><FilterMemory /></Suspense>
      {children}
    </AppShell>
  );
}
