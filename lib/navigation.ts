import {
  Home, ScanEye, Store, Clapperboard, Radio, TrendingUp, Folder, Users,
  type LucideIcon,
} from 'lucide-react';

// The one navigation map: the sidebar and the ⌘K palette both read it, so a
// screen added here is reachable from both.
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Small pill after the label, e.g. "Soon". */
  badge?: string;
}

export interface NavSection {
  /** null = the unlabelled top group, like PlatformDTC's DASHBOARD_NAV. */
  section: string | null;
  /** Renders the section as an expandable group (icon + chevron) instead of a label. */
  icon?: LucideIcon;
  items: NavItem[];
}

export const APP_NAV: NavSection[] = [
  { section: 'Overview', items: [
    { href: '/home', label: 'Home', icon: Home, description: 'Overview of your workspace' },
    { href: '/brandtracker', label: 'Brandtracker', icon: ScanEye, description: 'Brands you track and what changed' },
  ]},
  { section: 'Analyse', items: [
    { href: '/shops', label: 'Shops', icon: Store, description: 'Search the store index' },
    { href: '/ads', label: 'Ads', icon: Clapperboard, description: 'Browse the ad creative library' },
    { href: '/advertisers', label: 'Advertisers', icon: Radio, description: 'Brands ranked by creatives' },
    { href: '/trends', label: 'Trends', icon: TrendingUp, description: 'Trending niches, stores and products' },
  ]},
  { section: 'Favorites', icon: Folder, items: [
    { href: '/favorites/ads', label: 'Ads', icon: Folder, description: 'Your saved ads' },
    { href: '/favorites/shops', label: 'Shops', icon: Folder, description: 'Your saved shops' },
  ]},
  { section: 'Team', icon: Users, items: [
    { href: '/team/ads', label: 'Shared Ads', icon: Folder, description: 'Ads your team saved' },
    { href: '/team/shops', label: 'Shared Shops', icon: Folder, description: 'Shops your team saved' },
  ]},
];

export const SETTINGS_NAV: { href: string; label: string; description: string }[] = [
  { href: '/settings/account', label: 'Account Settings', description: 'Your personal profile' },
  { href: '/settings/security', label: 'Security', description: 'Email and password security' },
  { href: '/settings/workspace', label: 'Workspace Settings', description: 'Workspace identity and preferences' },
  { href: '/settings/members', label: 'Members', description: 'Invite and manage teammates' },
  { href: '/settings/api', label: 'API', description: 'Keys for the AdLibrarySpy API' },
  { href: '/settings/newsletter', label: 'Newsletter', description: 'The Monday report by email' },
];

/** Active on exact match, or on a sub-route (`/shops/123` keeps Shops lit). */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
