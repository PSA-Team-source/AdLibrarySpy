import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { latestWeeklyReport, weeklyReport, WEEK_RE } from '@/lib/weekly/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://adlibraryspy.com';

/**
 * Public, anonymous weekly leaderboard for the open-source AdLibrarySpy
 * companion (MCP server, CLI, leaderboard): GET /api/public/weekly[?week=2026-w39].
 *
 * Same contract as /api/public/store: no cookies or session are read, so the
 * body is identical for every caller and Cloudflare caches it (/api/public/*
 * cache rule, purged by tag adlibraryspy-public-html on release); the per-IP
 * limit only meters origin misses. `x_thread` is our internal draft copy and
 * is not part of the public report.
 */
const CACHE_OK = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_404 = 'public, max-age=300, s-maxage=600';
const NO_STORE = 'no-store';

function json(body: unknown, status: number, cache: string, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cache,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('week');
  const week = raw?.trim().toLowerCase() || null;
  if (week && !WEEK_RE.test(week)) {
    return json({ error: 'invalid_week', message: 'Pass ?week= as an ISO week, e.g. 2026-w39, or omit it for the latest report.' }, 400, CACHE_404);
  }

  // Cloudflare overwrites CF-Connecting-IP with the real client; X-Forwarded-For's
  // first hop is whatever the client claimed, so it only stands in off-edge.
  const ip = req.headers.get('cf-connecting-ip')?.trim() || clientIp(req.headers);
  try {
    const rl = await rateLimit(`pubweekly:${ip}`, 60, 60);
    if (!rl.allowed) {
      const retry = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
      return json({ error: 'rate_limited', message: 'Too many requests — try again in a minute.' }, 429, NO_STORE, { 'Retry-After': String(retry) });
    }
  } catch (err) {
    console.error('[api/public/weekly] rate limiter unavailable', err);
    return json({ error: 'unavailable', message: 'The weekly report is temporarily unavailable.' }, 503, NO_STORE, { 'Retry-After': '30' });
  }

  let report;
  try {
    report = week ? await weeklyReport(week) : await latestWeeklyReport();
  } catch (err) {
    console.error('[api/public/weekly] report lookup failed', week ?? 'latest', err);
    return json({ error: 'unavailable', message: 'The weekly report is temporarily unavailable.' }, 502, NO_STORE, { 'Retry-After': '30' });
  }
  if (!report) {
    return json({ error: 'not_found', week, message: week ? 'No report has been published for this week.' : 'No weekly report has been published yet.' }, 404, CACHE_404);
  }

  const { x_thread: _draft, ...data } = report.data;
  return json({
    week: report.week,
    publishedAt: report.publishedAt,
    url: `${SITE}/weekly/${report.week}`,
    data,
  }, 200, CACHE_OK);
}
