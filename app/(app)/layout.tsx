// Every page under this group requires a signed-in user with a workspace.
// requireCtx() redirects to /login when there is no valid session.
import { AppShell } from '@/components/layouts/app-shell';
import { requireCtx, userWorkspaces } from '@/lib/auth/guard';
import { trackerCount } from '@/lib/data';
import { one } from '@/lib/db';
import { MetaPixel } from '@/components/public/MetaPixel';
import { cookies } from 'next/headers';
import { REPO_URL, SKILL_DISMISS_COOKIE } from '@/lib/public/site';
import { sponsorUrl } from '@/lib/public/sponsor';
import type { Metadata } from 'next';

// Behind a login: never indexed (the public directory lives in the (public) group).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [trackers, workspaces, fresh, jar, donateUrl] = await Promise.all([
    trackerCount(ctx.workspaceId).catch(() => 0),
    userWorkspaces(ctx.user.id).catch(() => []),
    // Account under an hour old = the ad pixel's CompleteRegistration (sent once, see MetaPixel).
    one<{ fresh: boolean }>(`SELECT created_at > now() - interval '1 hour' AS fresh FROM users WHERE id = $1`, [ctx.user.id])
      .then(r => !!r?.fresh, () => false),
    cookies(),
    sponsorUrl(REPO_URL),
  ]);

  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      workspace={{ id: ctx.workspaceId, name: ctx.workspaceName, role: ctx.role }}
      workspaces={workspaces}
      trackers={trackers}
      skillAnnouncement={!jar.has(SKILL_DISMISS_COOKIE)}
      donateUrl={donateUrl}
    >
      <MetaPixel registeredUserId={fresh ? ctx.user.id : null} />
      {children}
    </AppShell>
  );
}
