// Whether this tab has moved between app screens since it loaded. A close/back
// control uses it to return where the reader came from (router.back) instead
// of a fixed list page — but only when "back" stays inside the app, never to
// another site or an empty tab. Set by DashboardShell on each route change.
let navigated = false;

export function markAppNavigation() { navigated = true; }
export function hasAppHistory() { return navigated; }
