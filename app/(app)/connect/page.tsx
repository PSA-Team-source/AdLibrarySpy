import { requireCtx } from '@/lib/auth/guard';
import { TOOLS, ALL_SCOPES } from '@/lib/mcp/tools';
import { issuer, listAuthorizedClients } from '@/lib/mcp/oauth';
import { timeAgo } from '@/lib/format';
import CopyField from '@/components/CopyField';
import { RevokeConnectionButton } from '@/components/Connections';
import { PageShell } from '@/components/layouts/page-shell';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Connect to AI' };
export const dynamic = 'force-dynamic';

const SCOPE_TEXT: Record<string, string> = {
  'identity.read': 'Workspace identity',
  'discovery.read': 'Search shops, ads and categories',
  'brandtrackers.read': 'Read tracked brands and changes',
  'brandtrackers.write': 'Add and remove tracked brands',
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const mcpUrl = `${issuer()}/api/mcp`;
  const connections = await listAuthorizedClients(ctx.workspaceId);

  return (
    <PageShell
      title="Connect to AI"
      description="Query the index from Claude, ChatGPT or any MCP-capable client. Authorization is OAuth 2.1 with PKCE — there is no API key to paste."
    >

      {sp.error && (
        <p role="alert" className="alert-error px-4 py-3">
          {sp.error === 'invalid_request'
            ? 'That authorization request was not valid and has been rejected.'
            : 'The connection request could not be completed.'}
        </p>
      )}


      <SectionCard title="Add the connector">
        <ol className="space-y-4 text-sm">
          <li>
            <div className="font-medium text-foreground">1. Open your assistant&apos;s connector settings</div>
            <div className="text-muted-foreground mt-0.5">
              In Claude: Settings → Connectors → Add custom connector.
            </div>
          </li>
          <li>
            <div className="font-medium text-foreground">2. Paste this MCP server URL</div>
            <div className="mt-2"><CopyField value={mcpUrl} /></div>
          </li>
          <li>
            <div className="font-medium text-foreground">3. Authorize</div>
            <div className="text-muted-foreground mt-0.5">
              You will be sent back here to approve access for <b>{ctx.workspaceName}</b>.
              The tools appear in your assistant straight after.
            </div>
          </li>
        </ol>
      </SectionCard>

      {connections.length > 0 && (
        <SectionCard title="Authorized applications" padded={false}>
          <ul className="divide-y divide-border">
            {connections.map(c => (
              <li key={c.client_id} className="px-6 py-3 flex flex-wrap items-center gap-3 text-sm transition-colors hover:bg-muted">
                <div>
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    connected {timeAgo(c.created_at)}
                    {c.last_used_at && ` · last used ${timeAgo(c.last_used_at)}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.scopes.map(s => <Badge key={s} variant="secondary" size="sm" className="font-mono font-medium">{s}</Badge>)}
                </div>
                <span className="flex-1" />
                <RevokeConnectionButton clientId={c.client_id} name={c.name} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title="Available tools"
        description={`${TOOLS.length} tools, each backed by a live query against the index.`}
      >
        <div className="grid md:grid-cols-2 gap-3">
          {TOOLS.map(t => (
            <div key={t.name} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-sm font-medium text-foreground">{t.name}</code>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Scopes">
        <ul className="space-y-2 text-sm">
          {ALL_SCOPES.map(s => (
            <li key={s} className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono font-medium">{s}</Badge>
              <span className="text-muted-foreground">{SCOPE_TEXT[s] ?? s}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageShell>
  );
}
