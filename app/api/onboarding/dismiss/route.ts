/**
 * Phase 36 — permanently dismiss the Getting Started checklist for this org.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  await sb.from('onboarding_progress').upsert({ org_id: orgId, dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'org_id' });
  return NextResponse.json({ ok: true });
}
