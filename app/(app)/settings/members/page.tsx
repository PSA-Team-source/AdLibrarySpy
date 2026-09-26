import { requireCtx, hasRole } from '@/lib/auth/guard';
import { listMembers, listInvites } from '@/lib/workspace';
import { dateShort } from '@/lib/format';
import { InviteUserDialog, MemberRow, InviteRow } from '@/components/Members';
import { SectionCard } from '@/components/ui/section-card';
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const ctx = await requireCtx();
  const [members, invites] = await Promise.all([listMembers(ctx.workspaceId), listInvites(ctx.workspaceId)]);
  const canManage = hasRole(ctx, 'admin');

  return (
    <div className="space-y-6">
      <SectionCard
        title="Team Members"
        description={`${members.length} member${members.length === 1 ? '' : 's'} in ${ctx.workspaceName}`}
        actions={canManage ? <InviteUserDialog /> : undefined}
        padded={false}
      >
        <Table className="min-w-[560px]" containerClassName="scroll-thin">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Joined On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, i) => (
              <MemberRow
                key={m.userId}
                index={i + 1}
                member={{ ...m, joinedAt: dateShort(m.joinedAt.toISOString()) }}
                canManage={canManage && m.role !== 'owner' && m.userId !== ctx.user.id}
              />
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Invitations" padded={invites.length === 0}>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {invites.map(i => (
              <InviteRow
                key={i.id}
                invite={{ id: i.id, email: i.email, role: i.role, expiresAt: dateShort(i.expiresAt.toISOString()) }}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
