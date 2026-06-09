/**
 * Phase 31.3 — Title agent portal API (token-gated).
 * Returns ONLY closing-relevant data: address, close date, closing checklist.
 * Application/income/credit/DTI/assets/rate are NEVER selected or returned.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: ta } = await sb
    .from('portal_title_agents')
    .select('id, lead_id, org_id, full_name, company_name, revoked, approved_by_lo, token_expires_at')
    .eq('token', params.token)
    .maybeSingle();
  if (!ta || ta.revoked || !ta.approved_by_lo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (ta.token_expires_at && new Date(ta.token_expires_at) < new Date()) return NextResponse.json({ error: 'Expired' }, { status: 404 });

  // Touch last access (best-effort).
  await sb.from('portal_title_agents').update({}).eq('id', ta.id).then(() => undefined, () => undefined);

  // ONLY closing-safe fields. No income/credit/dti/assets/rate columns selected.
  const { data: lead } = await sb
    .from('leads')
    .select('property_address, property_city, property_state, property_zip, closing_date, stage')
    .eq('id', ta.lead_id)
    .eq('org_id', ta.org_id)
    .maybeSingle();

  // Closing checklist = open conditions due prior to closing/funding (text only).
  const { data: conditions } = await sb
    .from('loan_conditions')
    .select('condition_text, status, priority')
    .eq('lead_id', ta.lead_id)
    .eq('org_id', ta.org_id)
    .neq('status', 'cleared');

  const address = [lead?.property_address, lead?.property_city, [lead?.property_state, lead?.property_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return NextResponse.json({
    title_agent: { name: ta.full_name, company: ta.company_name },
    loan: {
      property_address: address || null,
      closing_date: lead?.closing_date ?? null,
      stage: lead?.stage ?? null,
    },
    closing_checklist: (conditions ?? []).map((c) => ({ item: c.condition_text, priority: c.priority, status: c.status })),
    // Wire instructions are delivered out-of-band by the LO for security.
    wire_instructions_available: false,
  });
}
