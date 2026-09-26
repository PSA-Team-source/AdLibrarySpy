import { requireCtx, hasRole } from '@/lib/auth/guard';
import { workspaceRemovalBlocker } from '@/lib/workspace';
import { RenameWorkspaceForm, RemoveWorkspace } from '@/components/Workspace';
import { SectionCard } from '@/components/ui/section-card';

export const metadata = { title: 'Workspace Settings' };
export const dynamic = 'force-dynamic';

export default async function WorkspaceSettingsPage() {
  const ctx = await requireCtx();
  const canManage = hasRole(ctx, 'admin');
  const blocker = await workspaceRemovalBlocker(ctx.workspaceId, ctx.user.id, ctx.role);
  return (
    <div className="max-w-md space-y-6">
      <SectionCard title="Workspace Settings" description={canManage ? undefined : 'Only workspace administrators can change these settings.'}>
        {canManage
          ? <RenameWorkspaceForm name={ctx.workspaceName} slug={ctx.workspaceSlug} />
          : (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Workspace Title</dt><dd className="mt-0.5 font-medium text-foreground">{ctx.workspaceName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Workspace Slug</dt><dd className="mt-0.5 font-mono text-foreground">{ctx.workspaceSlug}</dd></div>
            </dl>
          )}
      </SectionCard>

      <SectionCard title={<span className="text-destructive">Danger Zone</span>} className="border-destructive/40">
        <RemoveWorkspace name={ctx.workspaceName} slug={ctx.workspaceSlug} blocker={blocker} />
      </SectionCard>
    </div>
  );
}
