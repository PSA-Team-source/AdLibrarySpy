import { requireCtx, hasRole } from '@/lib/auth/guard';
import { listApiKeys } from '@/lib/apikeys';
import { issuer } from '@/lib/mcp/oauth';
import { FAIR_USE } from '@/lib/ratelimit';
import { EXPORT_MAX_ROWS } from '@/lib/csv';
import { timeAgo, dateShort } from '@/lib/format';
import { CreateKeyForm, RevokeKeyButton } from '@/components/ApiKeys';
import CopyField from '@/components/CopyField';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export const metadata = { title: 'API Keys' };
export const dynamic = 'force-dynamic';

export default async function ApiSettingsPage() {
  const ctx = await requireCtx();
  const keys = await listApiKeys(ctx.workspaceId);
  const canManage = hasRole(ctx, 'admin');
  const endpoint = `${issuer()}/api/mcp`;
  const [burst, perWorkspace] = FAIR_USE.mcp('', '', '');
  const [, exportsPerDay] = FAIR_USE.export('', '');

  return (
    <div className="space-y-6">
      <SectionCard
        title="API Keys"
        description="Create and manage API keys for this workspace."
        padded={false}
      >
        {keys.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <Table className="sm:min-w-[640px] max-sm:[&_tr>*:nth-child(2):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(3):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(4):not([colspan])]:hidden" containerClassName="scroll-thin">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Scopes</TableHead>
                <TableHead>Created</TableHead><TableHead>Last used</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium text-foreground">{k.name}<code className="block font-mono text-xs font-normal text-muted-foreground sm:hidden">{k.keyPrefix}…</code></TableCell>
                  <TableCell><code className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</code></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">{k.scopes.map(s => <Badge key={s} variant="secondary" size="sm" className="font-mono font-medium">{s}</Badge>)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateShort(k.createdAt.toISOString())}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</TableCell>
                  {canManage && <TableCell className="text-right"><RevokeKeyButton id={k.id} /></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="border-t border-border px-6 py-5">
          {canManage
            ? <CreateKeyForm />
            : <p className="text-xs text-muted-foreground">Only workspace admins can create or revoke keys.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Using a key" description="Send the key as a bearer token to the MCP endpoint (JSON-RPC 2.0). The same tools as Connect to AI are available.">
        <div className="space-y-3 text-sm">
          <CopyField value={endpoint} />
          <pre className="scroll-thin overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">{`curl ${endpoint} \\
  -H "Authorization: Bearer $ADLIBRARYSPY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
          <p className="text-xs text-muted-foreground">
            Fair use keeps the API free: up to {burst.limit} tool calls a minute and {perWorkspace.limit.toLocaleString('en-US')} a day per workspace.
            Every response carries <code className="font-mono">X-RateLimit-Remaining</code> and <code className="font-mono">X-RateLimit-Reset</code> (seconds); a refusal is HTTP 429 with <code className="font-mono">Retry-After</code>.
          </p>
          <p className="text-xs text-muted-foreground">
            Need a spreadsheet instead? <b>Export CSV</b> on Shops and Ads downloads the current filters and sort, up to {EXPORT_MAX_ROWS.toLocaleString('en-US')} rows per file and {exportsPerDay.limit} files a day.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
