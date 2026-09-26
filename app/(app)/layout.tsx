// Every page under this group requires a signed-in user with a workspace.
// requireCtx() redirects to /login when there is no valid session.
import { AppShell } from '@/components/layouts/app-shell';
import { requireCtx, userWorkspaces } from '@/lib/auth/guard';
import { trackerCount } from '@/lib/data';
import type { Metadata } from 'next';

// Behind a login: never indexed (the public directory lives in the (public) group).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [trackers, workspaces] = await Promise.all([
    trackerCount(ctx.workspaceId).catch(() => 0),
    userWorkspaces(ctx.user.id).catch(() => []),
  ]);

  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      workspace={{ id: ctx.workspaceId, name: ctx.workspaceName, role: ctx.role }}
      workspaces={workspaces}
      trackers={trackers}
    >
      {children}
    </AppShell>
  );
}
