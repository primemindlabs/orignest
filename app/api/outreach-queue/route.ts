// Phase 102 — GET the outreach queue for the current org. Org-scoped (Clerk +
// admin client; RLS inert). Contacts are hydrated separately and reduced to the
// minimum the UI needs: first name only for borrowers, full name for realtors.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') ?? 'active';
  const channel = url.searchParams.get('channel');

  const sb = createAdminClient();
  let q = sb
    .from('outreach_queue')
    .select(
      'id, life_event_id, lead_id, realtor_id, scheduled_send_date, channel, message_draft, status, tcpa_acknowledged, sent_at, created_at'
    )
    .eq('org_id', orgId)
    .order('scheduled_send_date', { ascending: true });

  if (statusParam === 'active') q = q.in('status', ['queued', 'approved']);
  else q = q.eq('status', statusParam);
  if (channel === 'sms' || channel === 'email') q = q.eq('channel', channel);
  if (statusParam === 'sent') q = q.order('sent_at', { ascending: false });

  const { data: rows, error } = await q.limit(200);
  if (error) return NextResponse.json({ error: 'Failed to load queue' }, { status: 500 });

  // Hydrate event_type from life_events + contact from leads/realtors.
  const eventIds = Array.from(new Set((rows ?? []).map((r) => r.life_event_id)));
  const leadIds = Array.from(new Set((rows ?? []).map((r) => r.lead_id).filter(Boolean))) as string[];
  const realtorIds = Array.from(new Set((rows ?? []).map((r) => r.realtor_id).filter(Boolean))) as string[];

  const eventTypeById = new Map<string, string>();
  if (eventIds.length) {
    const { data } = await sb.from('life_events').select('id, event_type').in('id', eventIds);
    for (const e of data ?? []) eventTypeById.set(e.id as string, e.event_type as string);
  }
  const leadById = new Map<string, any>();
  if (leadIds.length) {
    const { data } = await sb.from('leads').select('id, first_name, phone, email').in('id', leadIds);
    for (const l of data ?? []) leadById.set(l.id as string, l);
  }
  const realtorById = new Map<string, any>();
  if (realtorIds.length) {
    const { data } = await sb
      .from('realtors')
      .select('id, first_name, last_name, phone, email')
      .in('id', realtorIds);
    for (const r of data ?? []) realtorById.set(r.id as string, r);
  }

  const items = (rows ?? []).map((r) => {
    const isRealtor = !!r.realtor_id;
    const c = isRealtor ? realtorById.get(r.realtor_id as string) : leadById.get(r.lead_id as string);
    const name = isRealtor
      ? `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || 'Realtor'
      : (c?.first_name as string | null) ?? 'Borrower';
    return {
      id: r.id,
      life_event_id: r.life_event_id,
      event_type: eventTypeById.get(r.life_event_id as string) ?? 'birthday',
      scheduled_send_date: r.scheduled_send_date,
      channel: r.channel,
      message_draft: r.message_draft,
      status: r.status,
      tcpa_acknowledged: r.tcpa_acknowledged,
      sent_at: r.sent_at,
      contact: { name, phone: c?.phone ?? null, email: c?.email ?? null },
    };
  });

  return NextResponse.json({ items });
}
