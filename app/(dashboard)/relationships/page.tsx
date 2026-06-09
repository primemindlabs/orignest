import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Users, DollarSign, Repeat, Bell } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Relationships' };

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default async function RelationshipsDashboardPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: rels }, { data: leads }] = await Promise.all([
    sb.from('borrower_relationships').select('id, full_name, email, lead_ids, rate_delta, estimated_equity, current_loan_balance, refi_alert_threshold').eq('org_id', orgId),
    sb.from('leads').select('email, stage, loan_amount').eq('org_id', orgId),
  ]);

  // Aggregate closed volume per borrower email.
  const byEmail: Record<string, { closed: number; volume: number }> = {};
  for (const l of leads ?? []) {
    const key = (l.email ?? '').toLowerCase();
    byEmail[key] ??= { closed: 0, volume: 0 };
    if (l.stage === 'closed') { byEmail[key].closed++; byEmail[key].volume += Number(l.loan_amount) || 0; }
  }

  const rows = (rels ?? []).map((r) => {
    const agg = byEmail[(r.email ?? '').toLowerCase()] ?? { closed: 0, volume: 0 };
    const equity = r.estimated_equity != null ? Number(r.estimated_equity) : null;
    const rateDelta = r.rate_delta != null ? Number(r.rate_delta) : null;
    const balance = r.current_loan_balance != null ? Number(r.current_loan_balance) : null;
    // Opportunity score: rate delta × balance (refi upside), else equity, else volume.
    const opp = rateDelta && balance ? rateDelta * balance : equity ?? agg.volume;
    const alert = rateDelta != null && rateDelta >= Number(r.refi_alert_threshold ?? 0.75);
    return { id: r.id, name: r.full_name, loans: (r.lead_ids ?? []).length, closed: agg.closed, volume: agg.volume, equity, rateDelta, alert, opp };
  }).sort((a, b) => b.opp - a.opp);

  const totalBorrowers = rows.length;
  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
  const avgLoans = totalBorrowers ? (rows.reduce((s, r) => s + r.loans, 0) / totalBorrowers) : 0;
  const alertCount = rows.filter((r) => r.alert).length;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Relationships</h1>
        <p className="text-label-2 text-sm mt-0.5">Your book of business — every borrower, ranked by opportunity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Borrowers', value: String(totalBorrowers), icon: Users },
          { label: 'Closed Volume', value: usd(totalVolume), icon: DollarSign },
          { label: 'Avg Loans / Borrower', value: avgLoans.toFixed(1), icon: Repeat },
          { label: 'Rate Alerts', value: String(alertCount), icon: Bell },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-card shadow-card p-4">
            <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2"><Icon size={15} className="text-gold-600" /> {label}</div>
            <p className="text-[22px] font-bold text-black tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Borrower', 'Loans', 'Closed', 'Volume', 'Equity', 'Rate Δ'].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-fill">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-black">{r.name}</span>
                    {r.alert && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gold-700 bg-gold-50 px-1.5 py-0.5 rounded-full"><Bell size={9} /> refi</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-label-2 tabular-nums">{r.loans}</td>
                <td className="px-4 py-3 text-sm text-label-2 tabular-nums">{r.closed}</td>
                <td className="px-4 py-3 text-sm font-mono tabular-nums text-black">{r.volume ? usd(r.volume) : '—'}</td>
                <td className="px-4 py-3 text-sm font-mono tabular-nums text-black">{r.equity != null ? usd(r.equity) : '—'}</td>
                <td className="px-4 py-3 text-sm font-mono tabular-nums text-black">{r.rateDelta != null ? `${r.rateDelta > 0 ? '+' : ''}${r.rateDelta.toFixed(3)}` : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-label-3">No borrower relationships yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-label-3">Equity and rate-delta populate as DeedMine AVM and current-rate feeds are connected. Borrowers auto-link across loans by email.</p>
    </div>
  );
}
