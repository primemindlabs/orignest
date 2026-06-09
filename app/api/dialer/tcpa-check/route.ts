/**
 * Phase 33.4 — single-lead TCPA check (used by click-to-call + dialer UI banner).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkTcpaCompliance } from '@/lib/dialer/tcpaGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { lead_id } = (await req.json().catch(() => ({}))) as { lead_id?: string };
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('property_state, phone').eq('id', lead_id).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!lead.phone) return NextResponse.json({ allowed: false, reason: 'No phone number on file.' });

  const result = await checkTcpaCompliance(sb, orgId, lead_id, lead.property_state);
  return NextResponse.json(result);
}
