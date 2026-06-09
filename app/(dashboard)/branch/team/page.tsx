import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branch Team' };

const ACTIVE = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', branch_manager: 'Branch Manager', loan_officer: 'Loan Officer', processor: 'Processor' };

export default async function BranchTeamPage() {
  const { orgId } = await requireTenantAdmin();
  const sb = createAdminClient();

  const [{ data: members }, { data: leads }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, role, email').eq('org_id', orgId).order('first_name'),
    sb.from('leads').select('assigned_to, stage, loan_amount').eq('org_id', orgId).is('archived_at', null),
  ]);

  const stat = new Map<string, { active: number; closed: number; value: number }>();
  for (const l of leads ?? []) {
    if (!l.assigned_to) continue;
    const s = stat.get(l.assigned_to) ?? { active: 0, closed: 0, value: 0 };
    if (ACTIVE.includes(l.stage)) { s.active += 1; s.value += Number(l.loan_amount ?? 0); }
    if (l.stage === 'closed') s.closed += 1;
    stat.set(l.assigned_to, s);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/branch" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Branch</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Team</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Every loan officer&apos;s pipeline at a glance.</p>
      </div>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Role</th><th className="text-right px-4 py-2">Active</th><th className="text-right px-4 py-2">Value</th><th className="text-right px-4 py-2">Closed</th></tr></thead>
          <tbody>
            {(members ?? []).map((m) => {
              const s = stat.get(m.id) ?? { active: 0, closed: 0, value: 0 };
              return (
                <tr key={m.id} className="border-b border-[var(--c-border)] last:border-0">
                  <td className="px-4 py-2.5"><p className="text-[var(--c-text)]">{`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email}</p></td>
                  <td className="px-4 py-2.5 text-[var(--c-label2)]">{ROLE_LABELS[m.role] ?? m.role}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--c-text)]">{s.active}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">${(s.value / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{s.closed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
