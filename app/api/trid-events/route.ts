// Phase 84 — POST a new TRID event (INSERT-only compliance record).
// Body: { lead_id, event_type, event_date, deadline_date?, notes? }
// Server computes business_days_to_deadline + is_compliant when a deadline is given.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { tridBusinessDaysRemaining } from '@/lib/compliance/trid';

export const runtime = 'nodejs';

const EVENT_TYPES = new Set([
  'le_issued', 'le_received', 'le_revised',
  'cd_issued', 'cd_received', 'cd_revised',
  'rate_lock_set', 'rate_lock_extended', 'closing_date_set',
]);

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      lead_id?: string; event_type?: string; event_date?: string; deadline_date?: string; notes?: string;
    };

    if (!body.lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    if (!body.event_type || !EVENT_TYPES.has(body.event_type)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 });
    }
    const eventDate = body.event_date || new Date().toISOString().slice(0, 10);

    const sb = createAdminClient();

    // Tenant check: the lead must belong to the caller's org.
    const { data: lead } = await sb.from('leads').select('id').eq('id', body.lead_id).eq('org_id', orgId).maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

    let businessDays: number | null = null;
    let isCompliant: boolean | null = null;
    if (body.deadline_date) {
      businessDays = tridBusinessDaysRemaining(new Date(body.deadline_date), new Date(eventDate));
      isCompliant = businessDays >= 0; // event on/before deadline = compliant
    }

    const { data: inserted, error } = await sb
      .from('trid_events')
      .insert({
        org_id: orgId,
        lead_id: body.lead_id,
        user_id: (profile?.id as string | undefined) ?? null,
        event_type: body.event_type,
        event_date: eventDate,
        deadline_date: body.deadline_date ?? null,
        business_days_to_deadline: businessDays,
        is_compliant: isCompliant,
        notes: body.notes ?? null,
      })
      .select('id, event_type, event_date, deadline_date, business_days_to_deadline, is_compliant, notes')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: inserted });
  } catch (err) {
    console.error('[trid-events POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
