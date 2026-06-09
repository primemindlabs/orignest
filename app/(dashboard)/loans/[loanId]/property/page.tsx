import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Waves, ClipboardCheck, Building, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

const usd = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));

export default async function PropertyOverviewPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, property_address, property_city, property_state, property_zip, property_type, loan_amount, estimated_value, flood_zone, flood_zone_required, flood_zone_determined_at, stage')
    .eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const base = `/loans/${lead.id}/property`;
  const avm = lead.estimated_value != null ? Number(lead.estimated_value) : null; // DeedMine AVM gated → falls back to estimated value
  const deedmineConnected = !!process.env.DEEDMINE_API_KEY;
  const ltv = avm && lead.loan_amount ? Math.round((Number(lead.loan_amount) / avm) * 1000) / 10 : null;
  const addr = [lead.property_address, lead.property_city, [lead.property_state, lead.property_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const isCondoPud = ['condo', 'townhouse'].includes((lead.property_type ?? '').toLowerCase());

  // Derived appraisal status from stage (no appraisal table yet).
  const stageOrder = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
  const si = stageOrder.indexOf(lead.stage);
  const appraisal = si >= stageOrder.indexOf('underwriting') ? 'Received' : si >= stageOrder.indexOf('processing') ? 'In Review' : 'Not ordered';

  const floodTone = lead.flood_zone == null ? 'var(--c-label2)' : lead.flood_zone_required ? 'var(--c-danger)' : 'var(--c-success)';

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Property</h1>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="text-[var(--c-label2)] mt-0.5" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-[var(--c-text)]">{addr || 'No address on file'}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[13px]">
              <span className="text-[var(--c-label2)]">AVM: <span className="font-mono text-[var(--c-text)]">{usd(avm)}</span> <span className="text-[var(--c-label3)]">({deedmineConnected ? 'DeedMine' : 'Est. value — DeedMine not connected'})</span></span>
              <span className="text-[var(--c-label2)]">Loan: <span className="font-mono text-[var(--c-text)]">{usd(lead.loan_amount != null ? Number(lead.loan_amount) : null)}</span></span>
              <span className="text-[var(--c-label2)]">LTV: <span className="font-mono text-[var(--c-text)]">{ltv != null ? `${ltv}%` : '—'}</span></span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`${base}/flood-zone`} className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-2.5 py-1" style={{ backgroundColor: 'var(--c-fill)', color: floodTone }}>
            <Waves size={12} /> {lead.flood_zone ? `Flood ${lead.flood_zone}${lead.flood_zone_required ? ' — insurance required' : ' — no insurance'}` : 'Flood — not determined'}
          </Link>
          <Link href={`${base}/appraisal`} className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-2.5 py-1 bg-[var(--c-fill)] text-[var(--c-label2)]">
            <ClipboardCheck size={12} /> Appraisal: {appraisal}
          </Link>
          {isCondoPud && (
            <Link href={`${base}/hoa`} className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-2.5 py-1 bg-[var(--c-fill)] text-[var(--c-label2)]">
              <Building size={12} /> HOA certification
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[
          { href: `${base}/details`, label: 'Property Details', icon: MapPin },
          { href: `${base}/appraisal`, label: 'Appraisal', icon: ClipboardCheck },
          { href: `${base}/flood-zone`, label: 'Flood Zone', icon: Waves },
          ...(isCondoPud ? [{ href: `${base}/hoa`, label: 'HOA Certification', icon: Building }] : []),
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 hover:bg-[var(--c-fill)] transition-colors">
            <div className="w-8 h-8 rounded-[9px] bg-[var(--c-fill)] flex items-center justify-center"><Icon size={15} className="text-[var(--c-label2)]" /></div>
            <span className="text-[13px] font-medium text-[var(--c-text)]">{label}</span>
          </Link>
        ))}
      </div>

      {!deedmineConnected && (
        <p className="text-[11px] text-[var(--c-label3)] flex items-center gap-1.5"><TrendingUp size={12} /> Live AVM shown once DeedMine is connected (DEEDMINE_API_KEY). Until then, the borrower-entered estimated value is used.</p>
      )}
    </div>
  );
}
