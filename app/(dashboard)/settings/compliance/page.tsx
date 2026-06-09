import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SLAEditor } from './SLAEditor';
import { ConditionTemplatesManager } from './ConditionTemplatesManager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Compliance & Templates' };

const PIPELINE_STAGES = [
  'new_inquiry', 'pre_qual', 'application', 'processing',
  'underwriting', 'conditional_approval', 'clear_to_close',
];

export default async function ComplianceSettingsPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: slaRows }, { data: templateRows }] = await Promise.all([
    sb
      .from('stage_sla_config')
      .select('stage, warning_days, critical_days, org_id')
      .or(`org_id.eq.${orgId},org_id.is.null`),
    sb
      .from('condition_templates')
      .select('id, org_id, loan_program, condition_text, category, priority, phase, display_order')
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .order('loan_program', { ascending: true })
      .order('display_order', { ascending: true }),
  ]);

  // Effective SLA per stage (org override wins over platform default).
  const byStage: Record<string, { warning_days: number; critical_days: number; is_custom: boolean }> = {};
  for (const row of slaRows ?? []) {
    const existing = byStage[row.stage];
    if (!existing || row.org_id) {
      byStage[row.stage] = {
        warning_days: row.warning_days,
        critical_days: row.critical_days,
        is_custom: !!row.org_id,
      };
    }
  }
  const sla = PIPELINE_STAGES.map((stage) => ({
    stage,
    warning_days: byStage[stage]?.warning_days ?? 3,
    critical_days: byStage[stage]?.critical_days ?? 7,
    is_custom: byStage[stage]?.is_custom ?? false,
  }));

  const templates = (templateRows ?? []).map((t) => ({ ...t, is_custom: !!t.org_id }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">
          Compliance &amp; Templates
        </h1>
        <p className="text-label-2 text-sm mt-0.5">
          Pipeline SLA thresholds and loan-program condition checklists.
        </p>
      </div>

      <SLAEditor initial={sla} canEdit={role === 'admin'} />
      <ConditionTemplatesManager initial={templates} canEdit={role === 'admin'} />
    </div>
  );
}
