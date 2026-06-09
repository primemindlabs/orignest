import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { CalendarDays, MapPin, ClipboardCheck, ShieldCheck, Lock } from 'lucide-react';
import { PortalChat } from '@/components/chat/PortalChat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Closing Portal', robots: { index: false, follow: false } };

const STAGE_LABELS: Record<string, string> = {
  underwriting: 'Underwriting', conditional_approval: 'Conditionally Approved',
  clear_to_close: 'Clear to Close', closed: 'Closed',
};

export default async function TitleAgentPortalPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: ta } = await sb
    .from('portal_title_agents')
    .select('id, lead_id, org_id, full_name, company_name, revoked, approved_by_lo, token_expires_at')
    .eq('token', params.token)
    .maybeSingle();
  if (!ta || ta.revoked || !ta.approved_by_lo) notFound();
  if (ta.token_expires_at && new Date(ta.token_expires_at) < new Date()) notFound();

  // Closing-safe fields ONLY — never income/credit/DTI/assets/rate.
  const { data: lead } = await sb
    .from('leads')
    .select('property_address, property_city, property_state, property_zip, closing_date, stage')
    .eq('id', ta.lead_id)
    .eq('org_id', ta.org_id)
    .maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', ta.org_id).maybeSingle();
  const { data: conditions } = await sb
    .from('loan_conditions')
    .select('condition_text, status')
    .eq('lead_id', ta.lead_id)
    .eq('org_id', ta.org_id)
    .neq('status', 'cleared');

  const address = [lead?.property_address, lead?.property_city, [lead?.property_state, lead?.property_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const isCtc = lead?.stage === 'clear_to_close' || lead?.stage === 'closed';

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <header className="bg-white border-b border-[rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">Closing Portal</p>
          <p className="text-[12px] text-[var(--c-label2)]">{ta.full_name} · {ta.company_name}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card icon={<MapPin size={15} />} label="Property" value={address || 'TBD'} />
          <Card icon={<CalendarDays size={15} />} label="Closing Date" value={lead?.closing_date ? new Date(lead.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'} />
          <Card icon={<ShieldCheck size={15} />} label="Status" value={STAGE_LABELS[lead?.stage ?? ''] ?? '—'} />
          <Card icon={<ClipboardCheck size={15} />} label="Clear to Close" value={isCtc ? 'Yes' : 'Not yet'} />
        </div>

        <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-5">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">Closing Checklist</h2>
          {(conditions ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--c-label2)]">No outstanding closing items.</p>
          ) : (
            <ul className="space-y-2">
              {(conditions ?? []).map((c, i) => (
                <li key={i} className="text-[13px] text-[var(--c-text)] flex items-start gap-2">
                  <ClipboardCheck size={14} className="text-[var(--c-label2)] flex-shrink-0 mt-0.5" /> {c.condition_text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-5 flex items-start gap-2.5">
          <Lock size={15} className="text-[var(--c-label2)] flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--c-label2)] leading-snug">
            Wire instructions are delivered separately by the loan officer and verified by phone for your security.
            This portal never displays borrower income, credit, or pricing details.
          </p>
        </div>

        <PortalChat apiBase={`/api/portal/title/${params.token}/chat`} selfType="realtor" loName={org?.name ?? 'the loan officer'} />
      </main>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center gap-1.5 text-[var(--c-label2)] mb-1">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{value}</p>
    </div>
  );
}
