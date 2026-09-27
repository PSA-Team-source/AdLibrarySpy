/**
 * The "Buy me a coffee" destination for `repoUrl` (REPO_URL): its owner's GitHub Sponsors page, or
 * null while it does not exist. GitHub answers 200 for a live listing and
 * redirects to the profile otherwise, so the Donate links appear on their own
 * the hour the listing is approved, and a dead link is never rendered.
 * Cached an hour (the homepage's ISR window); any failure hides the links.
 */
export async function sponsorUrl(repoUrl: string): Promise<string | null> {
  const url = `https://github.com/sponsors/${new URL(repoUrl).pathname.split('/')[1]}`;
  try {
    const res = await fetch(url, { redirect: 'manual', next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    return res.status === 200 ? url : null;
  } catch {
    return null;
  }
}
