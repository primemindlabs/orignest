import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGateStatus } from '@/lib/gates/clientFacingGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — the signed-in LO's client-facing readiness (NMLS gate + AE gate).
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, nmls_id').eq('clerk_user_id', userId).eq('org_id', orgId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const status = await getGateStatus(sb, profile.id as string, profile.nmls_id as string | null);
  return NextResponse.json(status);
}
