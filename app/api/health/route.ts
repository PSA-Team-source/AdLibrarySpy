import { NextResponse } from 'next/server';
import { dbHealthy } from '@/lib/db';
import { marketTokenConfigured } from '@/lib/market/token';
import { trafficProvider } from '@/lib/traffic/provider';
import { mailConfigured } from '@/lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A request made on the box itself (`curl http://127.0.0.1:4311/api/health`), not one that came
// through the nginx vhost. nginx sets X-Real-IP on every request it proxies to the app
// (deploy/adlibraryspy.com.conf), so public traffic always carries it. `next start`
// adds X-Forwarded-For itself from the socket peer, so that header is present on a local request
// too — it must name loopback, which also rejects a VPC host reaching the app port directly.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function isDirectLocalRequest(req: Request): boolean {
  const h = req.headers;
  if (h.get('x-real-ip')) return false;
  const xff = h.get('x-forwarded-for');
  if (!xff) return true;
  return xff.split(',').every((hop) => LOOPBACK.has(hop.trim()));
}

// Liveness + dependency readiness. The database is the only hard dependency.
//
// Public callers get the status and the HTTP code only. Which integrations are configured
// (mail, market API, traffic provider) and the deploy version are an operator's view
// of this deploy and a map for an attacker, so that detail is served only to a request made
// on the box itself.
export async function GET(req: Request) {
  const started = Date.now();
  const db = await dbHealthy();
  const status = db ? 'ok' : 'degraded';
  const headers = { 'Cache-Control': 'no-store' };
  const code = db ? 200 : 503;

  if (!isDirectLocalRequest(req)) {
    return NextResponse.json({ status }, { status: code, headers });
  }

  const body = {
    status,
    checks: {
      database: db,
      marketApi: marketTokenConfigured(),
      mail: mailConfigured(),
      trafficProvider: trafficProvider(),
    },
    latencyMs: Date.now() - started,
    version: process.env.APP_VERSION ?? 'dev',
  };
  return NextResponse.json(body, { status: code, headers });
}
