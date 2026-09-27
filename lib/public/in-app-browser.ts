/**
 * In-app browsers (the webview a social app opens links in). Google refuses
 * OAuth sign-in from embedded webviews ("Error 403: disallowed_useragent",
 * "Use secure browsers" in developers.google.com/identity/protocols/oauth2/policies), so a
 * Google button there is a dead end: the sign-up UI offers email instead.
 * Pure: shared by the client components and their self-check.
 */
const APPS: [RegExp, string][] = [
  [/Instagram/, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/, 'Facebook'],
  [/Threads/, 'Threads'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/LinkedInApp/, 'LinkedIn'],
  [/Snapchat/, 'Snapchat'],
  [/\bLine\//, 'LINE'],
];

/** The app's name when `ua` is a known in-app browser, else null. */
export function inAppBrowser(ua: string | null | undefined): string | null {
  if (!ua) return null;
  for (const [re, name] of APPS) if (re.test(ua)) return name;
  return null;
}

/**
 * Android only: an intent: URL that hands `url` to the phone's default browser
 * (Chrome's documented intent syntax, which the Facebook/Instagram webviews
 * follow). iOS webviews have no equivalent, so there is no link there.
 */
export function openInBrowserHref(ua: string, url: string): string | null {
  if (!/Android/i.test(ua)) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;end`;
  } catch { return null; }
}

/**
 * The page to hand to the phone's browser. That browser has none of this
 * webview's cookies, so the first touch (`als_ref`) and the ad click id (from
 * `_fbc`) ride along in the URL, where middleware.ts turns them back into cookies.
 */
export function handoffUrl(href: string, cookie: string): string {
  const u = new URL(href);
  const read = (name: string) => {
    const hit = cookie.split('; ').find(c => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
  };
  const ref = read('als_ref');
  if (ref) u.searchParams.set('ref', ref);
  const fbclid = read('_fbc').split('.').slice(3).join('.');
  if (fbclid && !u.searchParams.has('fbclid')) u.searchParams.set('fbclid', fbclid);
  return u.toString();
}
