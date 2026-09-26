// Audit log access. Every meaningful action in the product already writes an
// append-only row to `audit_log` (see lib/auth/guard.ts `audit()`); this module
// is the read side — paged, filterable, and exportable for compliance.
import { query } from '@/lib/db';

export interface AuditEntry {
  id: string;
  action: string;
  category: string;
  label: string;
  target: string | null;
  actorName: string | null;
  actorEmail: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number | null;
}

// Human-readable copy for each audited action. Actions that are not listed here
// still render (falling back to the raw action key) so a new action is never
// hidden — the label set just lags until it is added.
const LABELS: Record<string, string> = {
  'account.profile_updated': 'Updated profile',
  'account.password_changed': 'Changed password',
  'account.email_changed': 'Changed sign-in email',
  'member.invited': 'Invited a member',
  'member.invite_revoked': 'Revoked an invitation',
  'member.role_changed': 'Changed a member role',
  'member.removed': 'Removed a member',
  'workspace.renamed': 'Renamed the workspace',
  'workspace.slug_changed': 'Changed the workspace slug',
  'workspace.deleted': 'Removed a workspace',
  'oauth.authorized': 'Authorized an AI connection',
  'oauth.revoked': 'Revoked an AI connection',
  'apikey.created': 'Created an API key',
  'apikey.revoked': 'Revoked an API key',
  'billing.checkout_started': 'Started a plan checkout',
  'tracker.add': 'Tracked a brand',
  'tracker.remove': 'Untracked a brand',
  'shop.hidden': 'Hid a shop from Shops',
  'shop.unhidden': 'Unhid a shop',
  'tracker.folder_created': 'Created a tracker folder',
  'tracker.folder_deleted': 'Deleted a tracker folder',
  'tracker.moved': 'Moved a tracker to a folder',
};

function categoryOf(action: string): string {
  return action.split('.')[0] ?? action;
}

function labelOf(action: string): string {
  return LABELS[action] ?? action.replace(/[._]/g, ' ');
}

export function actionCategories(): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const action of Object.keys(LABELS)) {
    const c = categoryOf(action);
    if (seen.has(c)) continue;
    seen.add(c);
    out.push({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Paged, filterable audit rows for a workspace, newest first. */
export async function listAudit(
  workspaceId: string,
  opts: { page?: number; limit?: number; category?: string; q?: string } = {},
): Promise<AuditPage> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const where: string[] = ['a.workspace_id = $1'];
  const params: unknown[] = [workspaceId];

  if (opts.category) {
    params.push(`${opts.category}.%`);
    where.push(`a.action LIKE $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(
      `(a.target ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
    );
  }
  const whereSql = where.join(' AND ');

  const [rows, countRow] = await Promise.all([
    query<{
      id: string; action: string; target: string | null; ip: string | null;
      meta: Record<string, unknown>; created_at: Date;
      actor_name: string | null; actor_email: string | null;
    }>(
      `SELECT a.id, a.action, a.target, a.ip, a.meta, a.created_at,
              u.name AS actor_name, u.email AS actor_email
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    ),
    opts.category || opts.q
      ? query<{ n: string }>(
          `SELECT count(*) AS n FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE ${whereSql}`,
          params,
        )
      : Promise.resolve(null),
  ]);

  const items: AuditEntry[] = rows.map(r => ({
    id: r.id,
    action: r.action,
    category: categoryOf(r.action),
    label: labelOf(r.action),
    target: r.target,
    actorName: r.actor_name,
    actorEmail: r.actor_email,
    ip: r.ip,
    meta: r.meta ?? {},
    createdAt: r.created_at,
  }));

  return { items, total: countRow ? Number(countRow[0]?.n ?? 0) : null };
}

/** CSV-safe representation of a value (quoted only when it must be). */
function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Full export of a workspace's audit trail as CSV text. Immutable by design:
 * the trail cannot be edited or masked, so the export is a faithful dump.
 */
export async function auditCsv(workspaceId: string): Promise<string> {
  const rows = await query<{
    action: string; target: string | null; ip: string | null;
    meta: Record<string, unknown>; created_at: Date;
    actor_name: string | null; actor_email: string | null;
  }>(
    `SELECT a.action, a.target, a.ip, a.meta, a.created_at,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.workspace_id = $1
      ORDER BY a.created_at ASC`,
    [workspaceId],
  );

  const header = ['timestamp_utc', 'action', 'event', 'actor_name', 'actor_email', 'target', 'ip'];
  const lines = rows.map(r => [
    r.created_at.toISOString(),
    r.action,
    labelOf(r.action),
    r.actor_name,
    r.actor_email,
    r.target,
    r.ip,
  ]);
  return [header.map(cell).join(','), ...lines.map(l => l.map(cell).join(','))].join('\n');
}
