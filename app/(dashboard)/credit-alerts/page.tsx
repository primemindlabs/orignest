import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Credit Alerts' };

const ALERT_META: Record<string, { label: string; bg: string; bd: string }> = {
  inquiry: { label: '🚨 Competitor inquiry', bg: 'rgba(255,59,48,0.08)', bd: 'rgba(255,59,48,0.3)' },
  score_increase: { label: '📈 Score increased', bg: 'rgba(39,174,96,0.10)', bd: 'rgba(39,174,96,0.3)' },
  score_decrease: { label: '📉 Score decreased', bg: 'rgba(243,156,18,0.10)', bd: 'rgba(243,156,18,0.3)' },
  derogatory: { label: '⚠️ Derogatory item', bg: 'rgba(243,156,18,0.10)', bd: 'rgba(243,156,18,0.3)' },
  new_account: { label: '🆕 New account', bg: 'var(--c-fill)', bd: 'var(--c-border)' },
};

export default async function CreditAlertsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: alerts }, { data: enrollments }] = await Promise.all([
    sb.from('credit_alerts').select('id, alert_type, previous_score, new_score, score_delta, inquiring_lender, action_taken, actioned_at, received_at, leads(id, first_name, last_name)').eq('org_id', orgId).gte('received_at', thirtyDaysAgo).order('received_at', { ascending: false }).limit(100),
    sb.from('credit_monitoring_enrollments').select('id, vendor, monitoring_type, enrolled_at, leads(id, first_name, last_name, stage)').eq('org_id', orgId).eq('is_active', true).order('enrolled_at', { ascending: false }).limit(200),
  ]);

  const all = alerts ?? [];
  const actioned = all.filter((a) => a.actioned_at).length;
  const pending = all.length - actioned;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Credit Alerts</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{(enrollments ?? []).length} borrowers monitored · {all.length} alerts (30d) · {actioned} actioned · {pending} pending</p>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Recent alerts</p>
        {all.length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No credit alerts in the last 30 days. Enroll borrowers from their profile to start monitoring.</p>
        ) : (
          <div className="space-y-2">
            {all.map((a) => {
              const m = ALERT_META[a.alert_type] ?? ALERT_META.new_account;
              const lead = a.leads as { id?: string; first_name?: string; last_name?: string } | null;
              return (
                <div key={a.id} className="rounded-[12px] border p-3 flex items-center gap-3" style={{ background: m.bg, borderColor: m.bd }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--c-text)]">{m.label} · {lead?.first_name} {lead?.last_name}</p>
                    <p className="text-[11px] text-[var(--c-label2)]">{a.inquiring_lender ? `Pulled by ${a.inquiring_lender} · ` : ''}{a.previous_score && a.new_score ? `${a.previous_score} → ${a.new_score} · ` : ''}{new Date(a.received_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${a.actioned_at ? 'bg-[var(--c-fill)] text-[var(--c-label2)]' : 'bg-[var(--c-danger)] text-white'}`}>{a.actioned_at ? 'Actioned' : 'Pending'}</span>
                  {lead?.id && <Link href={`/leads/${lead.id}`} className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline flex-shrink-0">View →</Link>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Active monitoring</p>
        {(enrollments ?? []).length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No borrowers monitored yet.</p>
        ) : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
            {(enrollments ?? []).map((e) => {
              const lead = e.leads as { id?: string; first_name?: string; last_name?: string; stage?: string } | null;
              return (
                <Link key={e.id} href={lead?.id ? `/leads/${lead.id}` : '#'} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--c-fill)]">
                  <div><p className="text-[13px] text-[var(--c-text)]">{lead?.first_name} {lead?.last_name}</p><p className="text-[11px] text-[var(--c-label2)] capitalize">{String(e.vendor).replace('_', ' ')} · {String(e.monitoring_type).replace('_', ' ')}</p></div>
                  <span className="text-[11px] text-[var(--c-label2)] capitalize">{lead?.stage?.replace(/_/g, ' ')}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
