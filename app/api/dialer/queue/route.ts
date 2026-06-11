import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Active stages worth calling (verified CHECK values — no 'pre_qualified'/'application_started').
const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval'];

// GET /api/dialer/queue — callable leads enriched with the fields the priority
// scorer needs (last contact, stage age, closing date, open-condition count).
export async function GET(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data, error } = await sb
    .from('leads')
    .select(
      'id, first_name, last_name, phone, stage, loan_amount, estimated_value, property_state, last_contacted_at, first_contacted_at, stage_changed_at, closing_date, created_at'
    )
    .eq('org_id', org.id)
    .in('stage', ACTIVE_STAGES)
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = data ?? [];

  // Open-condition counts per lead in one round-trip (loan_conditions, status not closed).
  const ids = leads.map((l) => l.id);
  const openByLead: Record<string, number> = {};
  if (ids.length) {
    const { data: conds } = await sb.from('loan_conditions').select('lead_id, status').in('lead_id', ids);
    for (const c of conds ?? []) {
      const s = (c.status ?? '').toLowerCase();
      if (s === 'satisfied' || s === 'cleared' || s === 'waived') continue;
      if (c.lead_id) openByLead[c.lead_id] = (openByLead[c.lead_id] ?? 0) + 1;
    }
  }

  const enriched = leads.map((l) => ({ ...l, open_conditions: openByLead[l.id] ?? 0 }));

  const twilioNumber = process.env.TWILIO_PHONE_NUMBER ?? null;
  return NextResponse.json({ leads: enriched, twilioNumber });
}
