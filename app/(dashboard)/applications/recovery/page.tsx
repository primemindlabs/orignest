import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AbandonedApplicationCard } from '@/components/abandon-recovery/AbandonedApplicationCard';
import type { AbandonedSessionDashboard } from '@/types/abandonRecovery';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Application Recovery' };

type Filter = 'all' | 'abandoned' | 'completed';

export default async function ApplicationRecoveryPage({ searchParams }: { searchParams: { filter?: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const filter: Filter = (['all', 'abandoned', 'completed'].includes(searchParams.filter ?? '') ? searchParams.filter : 'all') as Filter;

  // org_id is the Supabase organizations.id uuid (see getOrgContext) — filter directly.
  const sb = createAdminClient();
  const { data } = await sb
    .from('application_sessions')
    .select('*, lead:leads!inner(first_name, last_name, phone), recovery_messages:abandon_recovery_messages(*)')
    .eq('org_id', orgId)
    .order('last_activity_at', { ascending: false })
    .limit(300);

  const sessions = (data ?? []) as unknown as AbandonedSessionDashboard[];
  const abandoned = sessions.filter((s) => !s.completed_at);
  const completed = sessions.filter((s) => s.completed_at);
  const visible = filter === 'abandoned' ? abandoned : filter === 'completed' ? completed : sessions;

  const tabs: { value: Filter; label: string }[] = [
    { value: 'all', label: `All (${sessions.length})` },
    { value: 'abandoned', label: `In progress (${abandoned.length})` },
    { value: 'completed', label: `Submitted (${completed.length})` },
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
        <ArrowLeft size={14} /> Applications
      </Link>
      <div className="mb-1">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Application Recovery</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          In-progress 1003 applications and their abandon-recovery status. Borrowers who pause get up to 3 reminder
          texts (2h, 24h, 72h) — only with SMS consent, within TCPA hours, and never after a STOP reply.
        </p>
      </div>

      <div className="flex gap-1 my-4">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/applications/recovery?filter=${t.value}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.value ? 'bg-[#C9A95C] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No applications here yet</p>
          <p className="text-xs text-gray-400 mt-1">
            In-progress 1003 sessions appear here once the application form starts recording them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <AbandonedApplicationCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
