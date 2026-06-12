// Phase 102 — list + manually add life events (org-scoped).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

const EVENT_TYPES = ['birthday', 'home_anniversary', 'loan_anniversary', 'realtor_anniversary'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ events: [] });

  const url = new URL(req.url);
  const sb = createAdminClient();
  let q = sb
    .from('life_events')
    .select('id, lead_id, realtor_id, event_type, event_date, recurring_annually, label, created_at')
    .eq('org_id', orgId)
    .order('event_date', { ascending: true });

  const eventType = url.searchParams.get('event_type');
  const leadId = url.searchParams.get('lead_id');
  const realtorId = url.searchParams.get('realtor_id');
  if (eventType) q = q.eq('event_type', eventType);
  if (leadId) q = q.eq('lead_id', leadId);
  if (realtorId) q = q.eq('realtor_id', realtorId);

  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const lead_id: string | null = body?.lead_id ?? null;
  const realtor_id: string | null = body?.realtor_id ?? null;
  const event_type: string = body?.event_type;
  const event_date: string = body?.event_date;
  const label: string | null = body?.label ?? null;

  if (!lead_id && !realtor_id) {
    return NextResponse.json({ error: 'lead_id or realtor_id is required' }, { status: 400 });
  }
  if (!EVENT_TYPES.includes(event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }
  if (!event_date || !/^\d{4}-\d{2}-\d{2}/.test(event_date)) {
    return NextResponse.json({ error: 'event_date must be YYYY-MM-DD' }, { status: 400 });
  }

  const sb = createAdminClient();

  // Attribute lead events to the assigned LO; realtor events are org-owned.
  let attributedLo: string | null = null;
  if (lead_id) {
    const { data: lead } = await sb
      .from('leads')
      .select('assigned_to')
      .eq('id', lead_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    attributedLo = (lead.assigned_to as string | null) ?? null;
  }

  // Upsert by partial-unique target (no ON CONFLICT possible → check then write).
  const targetCol = lead_id ? 'lead_id' : 'realtor_id';
  const targetVal = lead_id ?? realtor_id;
  const { data: existing } = await sb
    .from('life_events')
    .select('id')
    .eq('org_id', orgId)
    .eq(targetCol, targetVal)
    .eq('event_type', event_type)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from('life_events')
      .update({ event_date: event_date.slice(0, 10), label })
      .eq('id', existing.id)
      .select('id, event_type, event_date, label')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await sb
    .from('life_events')
    .insert({
      org_id: orgId,
      user_id: attributedLo,
      lead_id,
      realtor_id,
      event_type,
      event_date: event_date.slice(0, 10),
      label,
    })
    .select('id, event_type, event_date, label')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
