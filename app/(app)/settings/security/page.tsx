import { requireCtx } from '@/lib/auth/guard';
import { EmailForm, SignOutEverywhereForm } from '@/components/Account';
import { SectionCard } from '@/components/ui/section-card';

export const metadata = { title: 'Security' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const ctx = await requireCtx();
  return (
    <SectionCard title="Security Settings" description="Your sign-in address and signed-in devices." className="max-w-md" bodyClassName="space-y-8">
      <EmailForm email={ctx.user.email} />
      <div className="border-t border-border pt-6">
        <SignOutEverywhereForm />
      </div>
    </SectionCard>
  );
}
