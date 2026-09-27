'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound, Users, KeyRound, LockKeyhole, Settings, CreditCard, History, Mail, Bell, type LucideIcon } from 'lucide-react';
import { PageShell } from '@/components/layouts/page-shell';
import { SETTINGS_NAV, isNavActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  '/settings/account': UserRound,
  '/settings/security': LockKeyhole,
  '/settings/workspace': Settings,
  '/settings/billing': CreditCard,
  '/settings/members': Users,
  '/settings/api': KeyRound,
  '/settings/newsletter': Mail,
  '/settings/notifications': Bell,
  '/settings/activity': History,
};

// The activity log is a real settings screen (append-only audit trail); it sits
// after the shared SETTINGS_NAV tabs so the sidebar's nav config stays untouched.
const TABS = [...SETTINGS_NAV, { href: '/settings/activity', label: 'Activity', description: 'Workspace audit trail' }];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <PageShell title="Settings">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Workspace Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage your workspace settings here.</p>
      </div>

      <nav aria-label="Settings" className="border-b border-border">
        <div className="-mb-px flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ href, label }) => {
            const Icon = ICONS[href];
            const active = isNavActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--primaryColor)] text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0">{children}</div>
    </PageShell>
  );
}
