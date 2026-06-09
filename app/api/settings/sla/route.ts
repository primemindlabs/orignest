import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PIPELINE_STAGES = [
  'new_inquiry', 'pre_qual', 'application', 'processing',
  'underwriting', 'conditional_approval', 'clear_to_close',
];

// GET /api/settings/sla — effective SLA per stage (org override or platform default).
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('stage_sla_config')
    .select('stage, warning_days, critical_days, org_id')
    .or(`org_id.eq.${orgId},org_id.is.null`);

  const byStage: Record<string, { warning_days: number; critical_days: number; is_custom: boolean }> = {};
  for (const row of data ?? []) {
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

  return NextResponse.json({ sla });
}

// PUT /api/settings/sla — upsert org-specific SLA overrides (admins only).
// Body: { sla: [{ stage, warning_days, critical_days }] }
export async function PUT(req: NextRequest) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can edit SLA settings.' }, { status: 403 });
  }

  let body: { sla?: Array<{ stage: string; warning_days: number; critical_days: number }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = (body.sla ?? [])
    .filter((r) => PIPELINE_STAGES.includes(r.stage))
    .map((r) => {
      const warning = Math.max(0, Math.round(Number(r.warning_days) || 0));
      const critical = Math.max(warning, Math.round(Number(r.critical_days) || 0));
      return { stage: r.stage, warning_days: warning, critical_days: critical };
    });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid SLA rows.' }, { status: 422 });
  }

  const sb = createAdminClient();

  // Replace this org's overrides atomically: delete existing org rows, insert new.
  await sb.from('stage_sla_config').delete().eq('org_id', orgId);
  const { error } = await sb
    .from('stage_sla_config')
    .insert(rows.map((r) => ({ ...r, org_id: orgId })));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
