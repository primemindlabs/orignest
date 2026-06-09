import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, User } from 'lucide-react';
import { MyBookExport } from './MyBookExport';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Book' };

const PAST = ['closed', 'declined', 'withdrawn'];
const STAGE_LABEL: Record<string, string> = {
  new_inquiry: 'New Inquiry', pre_qual: 'Pre-Qual', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Cond. Approval', clear_to_close: 'Clear to Close',
  closed: 'Closed', declined: 'Declined', withdrawn: 'Withdrawn',
};

export default async function MyBookPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data: leads } = profile
    ? await sb.from('leads').select('id, first_name, last_name, email, phone, stage, loan_type, loan_amount, ownership_notes')
        .eq('org_id', orgId).eq('assigned_to', profile.id).eq('data_ownership', 'lo_personal').order('created_at', { ascending: false })
    : { data: [] };

  const all = leads ?? [];
  const active = all.filter((l) => !PAST.includes(l.stage));
  const closed = all.filter((l) => l.stage === 'closed');
  const other = all.filter((l) => ['declined', 'withdrawn'].includes(l.stage));

  function Section({ title, rows }: { title: string; rows: typeof all }) {
    if (rows.length === 0) return null;
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">{title} · {rows.length}</p>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
          {rows.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--c-fill)]">
              <div className="flex items-center gap-2 min-w-0">
                <Lock size={12} className="text-[var(--c-gold-deep)] flex-shrink-0" />
                <div className="min-w-0"><p className="text-[13px] text-[var(--c-text)] truncate">{l.first_name} {l.last_name}</p><p className="text-[11px] text-[var(--c-label2)] truncate">{l.email}{l.ownership_notes ? ` · ${l.ownership_notes}` : ''}</p></div>
              </div>
              <span className="text-[11px] text-[var(--c-label2)] flex-shrink-0">{STAGE_LABEL[l.stage] ?? l.stage}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">My Book</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Your personal contacts — past clients and referrals you brought in. This book travels with you.</p>
        </div>
        <MyBookExport />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Total contacts', all.length], ['Active loans', active.length], ['Past clients', closed.length]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5"><p className="text-[11px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[20px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
        ))}
      </div>

      {all.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <User size={24} className="text-[var(--c-label3)] mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-[var(--c-text)]">Your book is empty</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">When you add a lead, mark it &quot;My contact&quot; and it appears here.</p>
          <Link href="/leads/new" className="inline-block mt-3 text-[13px] text-[var(--c-gold-deep)] font-medium hover:underline">Add a contact →</Link>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Active" rows={active} />
          <Section title="Past clients" rows={closed} />
          <Section title="Other" rows={other} />
        </div>
      )}
    </div>
  );
}
