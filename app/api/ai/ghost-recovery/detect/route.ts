import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Days of inactivity (no updated_at change) before a lead in each stage is
// considered "ghosted". Keys are the real AshleyIQ lead stages.
const DEFAULT_THRESHOLDS: Record<string, number> = {
  new_inquiry: 3,
  pre_qualified: 10,
  application_started: 7,
  application_complete: 7,
  processing: 5,
  underwriting: 5,
};

export async function POST(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: customRules } = await sb
    .from('ghost_recovery_rules')
    .select('stage, days_threshold')
    .eq('org_id', org.id)
    .eq('is_active', true);

  const thresholds: Record<string, number> = {
    ...DEFAULT_THRESHOLDS,
    ...(customRules?.reduce((acc: Record<string, number>, r) => ({ ...acc, [r.stage as string]: Number(r.days_threshold) }), {}) ?? {}),
  };

  let totalDetected = 0;

  for (const [stage, days] of Object.entries(thresholds)) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: ghosted } = await sb
      .from('leads')
      .select('id, updated_at')
      .eq('org_id', org.id)
      .eq('stage', stage)
      .lt('updated_at', cutoff);

    if (!ghosted?.length) continue;

    for (const lead of ghosted) {
      const daysInactive = Math.floor(
        (Date.now() - new Date(lead.updated_at as string).getTime()) / (1000 * 60 * 60 * 24)
      );

      const { error } = await sb.from('ghost_recovery_queue').upsert(
        {
          org_id: org.id,
          lead_id: lead.id,
          stage_when_ghosted: stage,
          days_inactive: daysInactive,
          status: 'detected',
        },
        { onConflict: 'org_id,lead_id', ignoreDuplicates: true }
      );

      if (!error) totalDetected++;
    }
  }

  return NextResponse.json({ detected: totalDetected });
}
