import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { MapPin, CalendarDays, ShieldCheck } from 'lucide-react';
import { PERMISSION_TIER_DEFAULTS, type PermissionTier } from '@/lib/portal/realtorPermissions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Loan Status', robots: { index: false, follow: false } };

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'Application Received', pre_qual: 'Pre-Qualified', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Conditionally Approved', clear_to_close: 'Clear to Close', closed: 'Closed',
};

export default async function RealtorTeamPortalPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: member } = await sb
    .from('portal_realtor_team_members')
    .select('id, portal_realtor_id, org_id, full_name, role_on_team, revoked, approved_by_lo, token_expires_at')
    .eq('token', params.token)
    .maybeSingle();
  if (!member || member.revoked || !member.approved_by_lo) notFound();
  if (member.token_expires_at && new Date(member.token_expires_at) < new Date()) notFound();

  // Inherit the parent realtor's permission tier — cannot exceed it.
  const { data: parent } = await sb
    .from('portal_realtors')
    .select('lead_id, org_id, permission_tier, revoked')
    .eq('id', member.portal_realtor_id)
    .maybeSingle();
  if (!parent || parent.revoked) notFound();
  const perms = PERMISSION_TIER_DEFAULTS[(parent.permission_tier as PermissionTier) ?? 'status_only'];

  const { data: lead } = await sb
    .from('leads')
    .select('property_address, property_city, property_state, closing_date, stage')
    .eq('id', parent.lead_id)
    .eq('org_id', parent.org_id)
    .maybeSingle();
  if (!lead) notFound();

  const address = [lead.property_address, lead.property_city, lead.property_state].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <header className="bg-white border-b border-[rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">Loan Status</p>
          <p className="text-[12px] text-[var(--c-label2)]">{member.full_name} · {member.role_on_team.replace(/_/g, ' ')}</p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card icon={<MapPin size={15} />} label="Property" value={address || 'TBD'} />
          <Card icon={<ShieldCheck size={15} />} label="Status" value={STAGE_LABELS[lead.stage] ?? '—'} />
          {perms.see_closing_date && (
            <Card icon={<CalendarDays size={15} />} label="Closing Date" value={lead.closing_date ? new Date(lead.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'} />
          )}
        </div>
        <p className="text-[11px] text-[var(--c-label3)] text-center pb-4">
          Team access inherits the lead agent&apos;s permissions. Financial details are confidential to the borrower.
        </p>
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
