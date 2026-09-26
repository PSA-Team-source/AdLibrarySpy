import { requireCtx } from '@/lib/auth/guard';
import { ProfileForm, VerifyBanner } from '@/components/Account';
import { SectionCard } from '@/components/ui/section-card';

export const metadata = { title: 'Account Settings' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const ctx = await requireCtx();
  return (
    <div className="space-y-6">
      {!ctx.user.emailVerifiedAt && <VerifyBanner email={ctx.user.email} />}
      <SectionCard title="User Settings" description="How your name appears to your team." className="max-w-md">
        <ProfileForm name={ctx.user.name} />
      </SectionCard>
    </div>
  );
}
