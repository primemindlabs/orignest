import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Users, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branch' };

const ACTIVE = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const FUNNEL = [
  { key: 'application', label: 'Application' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'conditional_approval', label: 'Cond. Approval' },
  { key: 'clear_to_close', label: 'Clear to Close' },
  { key: 'closed', label: 'Closed' },
];

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default async function BranchDashboardPage() {
  const { orgId } = await requireTenantAdmin();

  const sb = createAdminClient();
  const [{ data: members }, { data: leads }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, role').eq('org_id', orgId),
    sb.from('leads').select('id, assigned_to, stage, loan_amount, closed_date').eq('org_id', orgId).is('archived_at', null),
  ]);

  const allLeads = leads ?? [];
  const som = startOfMonth();

  // Stage counts (funnel).
  const stageCount: Record<string, number> = {};
  for (const l of allLeads) stageCount[l.stage] = (stageCount[l.stage] ?? 0) + 1;

  // Per-LO leaderboard.
  const byLo = new Map<string, { name: string; pipeline: number; value: number; closesMtd: number }>();
  const nameOf = new Map((members ?? []).map((m) => [m.id, `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Unassigned']));
  for (const l of allLeads) {
    const id = l.assigned_to ?? 'unassigned';
    const row = byLo.get(id) ?? { name: nameOf.get(id) ?? 'Unassigned', pipeline: 0, value: 0, closesMtd: 0 };
    if (ACTIVE.includes(l.stage)) { row.pipeline += 1; row.value += Number(l.loan_amount ?? 0); }
    if (l.stage === 'closed' && l.closed_date && l.closed_date >= som.slice(0, 10)) row.closesMtd += 1;
    byLo.set(id, row);
  }
  const leaderboard = Array.from(byLo.values()).sort((a, b) => b.closesMtd - a.closesMtd || b.value - a.value);

  const totalActive = allLeads.filter((l) => ACTIVE.includes(l.stage)).length;
  const totalValue = allLeads.filter((l) => ACTIVE.includes(l.stage)).reduce((s, l) => s + Number(l.loan_amount ?? 0), 0);
  const maxFunnel = Math.max(1, ...FUNNEL.map((f) => stageCount[f.key] ?? 0));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Branch Dashboard</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Team pipeline, leaderboard, and conversion across all your loan officers.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Active loans', String(totalActive)], ['Pipeline value', `$${(totalValue / 1_000_000).toFixed(1)}M`], ['Team members', String((members ?? []).length)]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5"><p className="text-[11px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[20px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
        ))}
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-2"><Trophy size={15} className="text-[var(--c-gold-deep)]" /><h2 className="text-[14px] font-semibold text-[var(--c-text)]">Leaderboard</h2><Link href="/branch/team" className="text-[12px] text-[var(--c-gold-deep)] hover:underline ml-auto">Team detail →</Link></div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">LO</th><th className="text-right px-4 py-2">Pipeline</th><th className="text-right px-4 py-2">Value</th><th className="text-right px-4 py-2">Closes MTD</th></tr></thead>
            <tbody>
              {leaderboard.map((r, i) => (
                <tr key={r.name + i} className="border-b border-[var(--c-border)] last:border-0">
                  <td className="px-4 py-2.5 text-[var(--c-text)]">{r.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{r.pipeline}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">${(r.value / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-[var(--c-gold-deep)]">{r.closesMtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Funnel */}
      <div>
        <div className="flex items-center gap-2 mb-2"><TrendingUp size={15} className="text-[var(--c-gold-deep)]" /><h2 className="text-[14px] font-semibold text-[var(--c-text)]">Conversion funnel</h2></div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
          {FUNNEL.map((f) => {
            const c = stageCount[f.key] ?? 0;
            return (
              <div key={f.key} className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--c-label2)] w-28">{f.label}</span>
                <div className="h-5 rounded-md bg-[var(--c-fill)] flex-1 overflow-hidden"><div className="h-full rounded-md" style={{ width: `${(c / maxFunnel) * 100}%`, background: 'var(--c-gold)' }} /></div>
                <span className="text-[12px] font-mono tabular-nums text-[var(--c-text)] w-8 text-right">{c}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
