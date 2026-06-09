/**
 * Phase 36 — mark an onboarding step done (manual) / dismiss the checklist.
 *   POST /api/onboarding/progress  { step }   → mark step complete
 *   POST /api/onboarding/dismiss              → hide the checklist
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STEPS = ['company_profile', 'phone_number', 'first_lead', 'first_message', 'import_contacts'];

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { step } = (await req.json().catch(() => ({}))) as { step?: string };
  if (!step || !STEPS.includes(step)) return NextResponse.json({ error: 'Invalid step' }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing } = await sb.from('onboarding_progress').select('steps').eq('org_id', orgId).maybeSingle();
  const steps = { ...(existing?.steps ?? {}), [step]: true };

  await sb.from('onboarding_progress').upsert({ org_id: orgId, steps, updated_at: new Date().toISOString() }, { onConflict: 'org_id' });
  return NextResponse.json({ ok: true, steps });
}
