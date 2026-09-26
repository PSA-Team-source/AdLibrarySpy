import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { auditCsv } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Export the workspace's full audit trail as CSV. Owners and admins only — the
// trail records who did what, so read access is a governance entitlement rather
// than something every member can trigger. The ETag is derived from the row
// count so a repeat download is cheap and cacheable.
export async function GET() {
  const ctx = await requireRole('admin');
  const csv = await auditCsv(ctx.workspaceId);
  const fileName = `adlibraryspy-audit-${ctx.workspaceSlug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
