import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, X, AlertTriangle, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { assessWarrantability, type HoaInput, type WarrantabilityResult } from '@/lib/hoa/warrantability';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: string }> = {
  warrantable: { label: 'Warrantable', color: '#27AE60' },
  conditional: { label: 'Conditional', color: '#F39C12' },
  non_warrantable: { label: 'Non-Warrantable', color: 'var(--c-danger)' },
  review_needed: { label: 'Review needed', color: 'var(--c-label2)' },
};

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('*').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  // Saved HOA questionnaire (may not exist). Be defensive — table/columns may be absent.
  let q: Record<string, unknown> | null = null;
  try {
    const { data } = await sb.from('hoa_questionnaires').select('*').eq('org_id', orgId).eq('loan_id', params.loanId).maybeSingle();
    q = data ?? null;
  } catch {
    q = null;
  }

  const hoaLink = `/loans/${params.loanId}/hoa`;
  const propType = String((lead as Record<string, unknown>).property_type ?? '').toLowerCase();
  const isAttachedProject = propType.includes('condo') || propType.includes('pud') || propType.includes('co-op') || propType.includes('co_op');

  // No assessment saved yet — empty / CTA state.
  if (!q) {
    return (
      <div className="max-w-2xl space-y-4">
        <Header />
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-center">
          <ShieldCheck size={28} className="mx-auto text-[var(--c-label3)]" />
          <p className="text-[14px] font-semibold text-[var(--c-text)] mt-2">No warrantability assessment yet</p>
          <p className="text-[12.5px] text-[var(--c-label2)] mt-1 max-w-sm mx-auto">
            {isAttachedProject
              ? 'This loan is on a condo/PUD project but has no completed HOA questionnaire. Run the warrantability check before underwriting sign-off.'
              : 'If this property is part of a condo, PUD, or co-op project, complete the HOA questionnaire to confirm Fannie/Freddie warrantability.'}
          </p>
          <Link href={hoaLink} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white mt-4">
            Open warrantability tool <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  // Recompute authoritatively from the saved inputs (pure lib).
  const input: HoaInput = {
    project_type: (q.project_type as HoaInput['project_type']) ?? undefined,
    total_units: numOrUndef(q.total_units),
    owner_occupancy_pct: numOrUndef(q.owner_occupancy_pct),
    single_investor_pct: numOrUndef(q.single_investor_pct),
    commercial_space_pct: numOrUndef(q.commercial_space_pct),
    reserve_pct_of_budget: numOrUndef(q.reserve_pct_of_budget),
    delinquency_pct_30_plus: numOrUndef(q.delinquency_pct_30_plus),
    pending_special_assessment: boolOrUndef(q.pending_special_assessment),
    special_assessment_amount: numOrUndef(q.special_assessment_amount),
    hazard_insurance_adequate: boolOrUndef(q.hazard_insurance_adequate),
    flood_insurance_required: boolOrUndef(q.flood_insurance_required),
    flood_insurance_obtained: boolOrUndef(q.flood_insurance_obtained),
    fidelity_bond_obtained: boolOrUndef(q.fidelity_bond_obtained),
    pending_litigation: boolOrUndef(q.pending_litigation),
    litigation_insurance_covered: boolOrUndef(q.litigation_insurance_covered),
    construction_defect_litigation: boolOrUndef(q.construction_defect_litigation),
    physical_deficiencies: boolOrUndef(q.physical_deficiencies),
    deficiency_description: (q.deficiency_description as string) ?? undefined,
  };
  const result: WarrantabilityResult = assessWarrantability(input);
  const s = STATUS[result.status] ?? STATUS.review_needed;
  const assessedAt = q.assessed_at ? new Date(String(q.assessed_at)) : null;
  const projectName = (q.project_name as string) || null;

  return (
    <div className="max-w-2xl space-y-4">
      <Header />

      {/* Status banner */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck size={22} style={{ color: s.color }} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-tight" style={{ color: s.color }}>{s.label}</p>
              <p className="text-[12px] text-[var(--c-label2)] truncate">
                {projectName ? `${projectName} · ` : ''}
                {String(input.project_type ?? 'project').replace('_', '-')}
                {assessedAt ? ` · assessed ${assessedAt.toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>
          <Link href={hoaLink} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline flex-shrink-0">
            Edit <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* Findings */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        {result.disqualifying_factors.length > 0 && (
          <FindingGroup label={`Disqualifying (${result.disqualifying_factors.length})`} labelColor="var(--c-danger)">
            {result.disqualifying_factors.map((d, i) => (
              <p key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--c-text)]"><X size={12} className="text-[var(--c-danger)] mt-0.5 flex-shrink-0" /> {d}</p>
            ))}
          </FindingGroup>
        )}
        {result.conditional_factors.length > 0 && (
          <FindingGroup label={`Conditions to clear (${result.conditional_factors.length})`} labelColor="#B45309">
            {result.conditional_factors.map((d, i) => (
              <p key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--c-text)]"><AlertTriangle size={12} className="text-[#F39C12] mt-0.5 flex-shrink-0" /> {d}</p>
            ))}
          </FindingGroup>
        )}
        {result.passed_criteria.length > 0 && (
          <FindingGroup label={`Passed (${result.passed_criteria.length})`} labelColor="#27AE60">
            {result.passed_criteria.map((d, i) => (
              <p key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--c-label2)]"><Check size={12} className="text-[#27AE60] mt-0.5 flex-shrink-0" /> {d}</p>
            ))}
          </FindingGroup>
        )}
        {result.disqualifying_factors.length === 0 && result.conditional_factors.length === 0 && result.passed_criteria.length === 0 && (
          <p className="text-[12.5px] text-[var(--c-label2)]">No findings recorded — open the tool to complete the questionnaire.</p>
        )}
      </div>

      {/* Lender alternatives when non-warrantable */}
      {result.lender_options.length > 0 && (
        <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-1.5">Non-warrantable — consider</p>
          <ul className="space-y-0.5">
            {result.lender_options.map((o, i) => (
              <li key={i} className="text-[12.5px] text-[var(--c-gold-deep)]">• {o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">HOA (Underwriting)</h1>
      <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
        Condo/PUD warrantability findings for underwriting sign-off, recomputed from the saved questionnaire.
      </p>
    </div>
  );
}

function FindingGroup({ label, labelColor, children }: { label: string; labelColor: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: labelColor }}>{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function boolOrUndef(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  return Boolean(v);
}
