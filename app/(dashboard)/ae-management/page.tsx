import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { deriveFeatureSet } from '@/lib/platform/featureFlags';
import { RateExceptionReview } from './RateExceptionReview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Wholesale Team' };

function health(last: string | null): 'active' | 'at_risk' | 'dormant' | 'new' {
  if (!last) return 'new';
  const d = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  return d <= 14 ? 'active' : d <= 45 ? 'at_risk' : 'dormant';
}
const fmtM = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`);

export default async function AEManagementPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('channel').eq('id', orgId).maybeSingle();
  if (!deriveFeatureSet(org?.channel, role).ae_department_head && role !== 'admin') notFound();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: brokers }, { data: activities }, { data: profiles }, { data: exceptions }] = await Promise.all([
    sb.from('broker_accounts').select('id, assigned_ae_id, company_name, address_state, last_submission_at, volume_ytd').eq('org_id', orgId).limit(2000),
    sb.from('ae_activities').select('ae_id, activity_type, activity_date').eq('org_id', orgId).gte('activity_date', monthStart).limit(5000),
    sb.from('profiles').select('id, first_name, last_name').eq('org_id', orgId),
    sb.from('rate_exception_requests').select('id, loan_type, loan_amount, exception_type, requested_rate, justification, broker_account_id').eq('org_id', orgId).eq('status', 'pending').order('requested_at', { ascending: false }).limit(50),
  ]);

  const nameOf = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'AE']));
  const brokerName = new Map((brokers ?? []).map((b) => [b.id, b.company_name]));
  const allBrokers = (brokers ?? []).map((b) => ({ ...b, _health: health(b.last_submission_at) }));

  // Per-AE aggregation.
  const aeIds = Array.from(new Set(allBrokers.map((b) => b.assigned_ae_id).filter(Boolean) as string[]));
  const callsByAe = new Map<string, number>();
  for (const a of activities ?? []) if (a.ae_id) callsByAe.set(a.ae_id, (callsByAe.get(a.ae_id) ?? 0) + 1);
  const scorecards = aeIds.map((id) => {
    const mine = allBrokers.filter((b) => b.assigned_ae_id === id);
    return {
      id, name: nameOf.get(id) ?? 'AE', broker_count: mine.length,
      at_risk: mine.filter((b) => b._health === 'at_risk' || b._health === 'dormant').length,
      calls: callsByAe.get(id) ?? 0,
      volume: mine.reduce((s, b) => s + Number(b.volume_ytd ?? 0), 0),
    };
  }).sort((a, b) => b.volume - a.volume);

  const teamAtRisk = allBrokers.filter((b) => b._health === 'at_risk' || b._health === 'dormant');
  const pendingExc = (exceptions ?? []).map((e) => ({ ...e, broker: e.broker_account_id ? brokerName.get(e.broker_account_id) ?? null : null }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Wholesale Team</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{scorecards.length} AEs · {allBrokers.length} broker accounts · {teamAtRisk.length} at-risk/dormant this month</p>
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">AE scorecards</h2>
        {scorecards.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No AEs with assigned brokers yet.</p> : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">AE</th><th className="text-right px-4 py-2">Brokers</th><th className="text-right px-4 py-2">Calls (MTD)</th><th className="text-right px-4 py-2">At risk</th><th className="text-right px-4 py-2">Volume YTD</th></tr></thead>
              <tbody>
                {scorecards.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--c-border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--c-text)]">{s.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{s.broker_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--c-label2)]">{s.calls}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: s.at_risk > 5 ? 'var(--c-danger)' : 'var(--c-text)' }}>{s.at_risk}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--c-gold-deep)]">{fmtM(s.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">At-risk brokers across team ({teamAtRisk.length})</h2>
        {teamAtRisk.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No at-risk brokers — strong coverage.</p> : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
            {teamAtRisk.slice(0, 20).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                <div><p className="text-[13px] text-[var(--c-text)]">{b.company_name}{b.address_state ? ` · ${b.address_state}` : ''}</p><p className="text-[11px] text-[var(--c-label2)]">AE: {b.assigned_ae_id ? nameOf.get(b.assigned_ae_id) : 'Unassigned'}</p></div>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full" style={{ color: b._health === 'dormant' ? 'var(--c-danger)' : '#F39C12', backgroundColor: 'var(--c-fill)' }}>{b._health.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Rate exceptions pending ({pendingExc.length})</h2>
        <RateExceptionReview initial={pendingExc as never} />
      </div>
    </div>
  );
}
