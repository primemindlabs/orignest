import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { MyTasksClient } from './MyTasksClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Tasks' };

export default async function MyTasksPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">My Tasks</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Everything that needs action across the files you support — not a pipeline, a to-do list.</p>
      </div>
      <MyTasksClient myProfileId={profile?.id ?? null} />
    </div>
  );
}
