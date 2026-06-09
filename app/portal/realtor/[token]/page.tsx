import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { CheckCircle, Circle, Phone, CalendarDays, ClipboardCheck, ShieldCheck, Lock } from 'lucide-react';
import type { RealtorPermissions } from '@/lib/portal/realtorPermissions';
import { RealtorTransactions } from './RealtorTransactions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Loan Status', robots: { index: false, follow: false } };

const STAGE_ORDER = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'Application Received', pre_qual: 'Pre-Qualified', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Conditionally Approved', clear_to_close: 'Clear to Close', closed: 'Closed',
};

export default async function RealtorPortalPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: realtor } = await sb
    .from('portal_realtors')
    .select('id, lead_id, org_id, realtor_name, permission_tier, custom_permissions, revoked, token_expires_at, approved_by_lo')
    .eq('token', params.token)
    .maybeSingle();

  if (!realtor || realtor.revoked || !realtor.approved_by_lo) notFound();
  if (realtor.token_expires_at && new Date(realtor.token_expires_at) < new Date()) notFound();

  const perms = realtor.custom_permissions as RealtorPermissions;

  // Only NON-FINANCIAL fields are ever selected for a realtor route.
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, closing_date, assigned_to, property_address, property_city, property_state')
    .eq('id', realtor.lead_id)
    .maybeSingle();
  if (!lead) notFound();

  const [{ data: lo }, { data: org }, { count: openConditions }, { data: lock }] = await Promise.all([
    lead.assigned_to ? sb.from('profiles').select('first_name, last_name, phone, nmls_id, avatar_url').eq('id', lead.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('organizations').select('name').eq('id', realtor.org_id).maybeSingle(),
    sb.from('loan_conditions').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id).neq('status', 'cleared'),
    sb.from('rate_lock_expirations').select('lock_expires_at, status').eq('lead_id', lead.id).maybeSingle(),
  ]);

  // Log the view (INSERT-only event table).
  await sb.from('portal_realtor_events').insert({ realtor_id: realtor.id, lead_id: lead.id, org_id: realtor.org_id, event_type: 'portal_viewed' });

  const stageIdx = STAGE_ORDER.indexOf(lead.stage);
  const milestones = STAGE_ORDER.map((s, i) => ({ stage: s, label: STAGE_LABELS[s], status: i < stageIdx ? 'completed' : i === stageIdx ? 'current' : 'upcoming' as const }));
  const isCtc = ['clear_to_close', 'closed'].includes(lead.stage);
  const appraisalStatus = stageIdx >= STAGE_ORDER.indexOf('underwriting') ? 'Received' : stageIdx >= STAGE_ORDER.indexOf('processing') ? 'Ordered' : 'Not yet ordered';
  const loName = lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() : 'your loan officer';
  const propAddr = [lead.property_address, lead.property_city, lead.property_state].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <header className="bg-white border-b border-[rgba(0,0,0,0.08)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lo?.avatar_url ? <img src={lo.avatar_url} alt={loName} className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-[var(--c-gold)] flex items-center justify-center text-white text-[12px] font-bold">{loName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>}
            <div>
              <p className="text-[13px] font-semibold text-[var(--c-text)]">Working with {loName}</p>
              <p className="text-[11px] text-[var(--c-label3)]">{org?.name ?? ''}</p>
            </div>
          </div>
          {perms.message_lo && lo?.phone && <a href={`tel:${lo.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--c-gold)] text-white text-[12px] font-semibold rounded-full"><Phone size={13} /> Call</a>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] text-[var(--c-label3)]">Loan for</p>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">{lead.first_name} {lead.last_name?.[0]}.</h1>
          {propAddr && <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{propAddr}</p>}
        </div>

        {perms.see_stage && perms.see_milestones && (
          <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-5">
            <h2 className="text-[13px] font-semibold text-[var(--c-text)] mb-4">Loan Progress</h2>
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.stage} className="flex items-center gap-3">
                  {m.status === 'completed' ? <CheckCircle size={17} className="text-[var(--c-success)]" /> : m.status === 'current' ? <div className="w-[17px] h-[17px] rounded-full border-2 border-[var(--c-gold)] flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-[var(--c-gold)]" /></div> : <Circle size={17} className="text-[var(--c-label3)]" />}
                  <span className={`text-[13px] ${m.status === 'current' ? 'text-[var(--c-text)] font-semibold' : m.status === 'completed' ? 'text-[var(--c-label2)]' : 'text-[var(--c-label3)]'}`}>{m.label}</span>
                  {m.status === 'current' && <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">Current</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {perms.see_closing_date && (
            <Card icon={<CalendarDays size={15} />} label="Closing Date" value={lead.closing_date ? new Date(lead.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'} />
          )}
          {perms.see_ctc_status && (
            <Card icon={<ShieldCheck size={15} />} label="Clear to Close" value={isCtc ? 'Yes' : 'Not yet'} />
          )}
          {perms.see_appraisal_status && (
            <Card icon={<ClipboardCheck size={15} />} label="Appraisal" value={appraisalStatus} />
          )}
          {perms.see_conditions_count && (
            <Card icon={<ClipboardCheck size={15} />} label="Open Conditions" value={String(openConditions ?? 0)} />
          )}
          {perms.see_rate_lock_expiry && lock?.lock_expires_at && lock.status !== 'floating' && (
            <Card icon={<Lock size={15} />} label="Rate Lock Expires" value={new Date(lock.lock_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
          )}
        </div>

        <RealtorTransactions token={params.token} />

        <p className="text-[11px] text-[var(--c-label3)] text-center pb-4">
          This portal shows loan status only. Financial details are confidential to the borrower.
        </p>
      </main>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center gap-1.5 text-[var(--c-label2)] mb-1">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <p className="text-[15px] font-semibold text-[var(--c-text)]">{value}</p>
    </div>
  );
}
