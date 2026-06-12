// Phase 104 — loans with a rate lock expiring within N CFPB business days (org-scoped).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { addTRIDBusinessDays, tridBusinessDaysRemaining } from '@/lib/compliance/trid';

export async function GET(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ alerts: [] });

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') ?? '5', 10) || 5;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = addTRIDBusinessDays(today, days).toISOString().slice(0, 10);

  const sb = createAdminClient();
  const { data: locks, error } = await sb
    .from('rate_lock_requests')
    .select('id, lead_id, requested_lock_expiration, status, extension_status')
    .eq('org_id', orgId)
    .not('requested_lock_expiration', 'is', null)
    .not('status', 'in', '(cancelled,declined)')
    .gte('requested_lock_expiration', todayStr)
    .lte('requested_lock_expiration', cutoffStr)
    .order('requested_lock_expiration', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leadIds = Array.from(new Set((locks ?? []).map((l) => l.lead_id).filter(Boolean))) as string[];
  const leadById = new Map<string, any>();
  if (leadIds.length) {
    const { data } = await sb
      .from('leads')
      .select('id, first_name, last_name, loan_amount, stage')
      .in('id', leadIds);
    for (const l of data ?? []) leadById.set(l.id as string, l);
  }

  const alerts = (locks ?? []).map((l) => {
    const lead = leadById.get(l.lead_id as string);
    const expiry = l.requested_lock_expiration as string;
    return {
      id: l.id,
      lead_id: l.lead_id,
      lock_expiry_date: expiry,
      extension_status: l.extension_status ?? 'none',
      business_days_left: tridBusinessDaysRemaining(new Date(expiry), today),
      lead: lead
        ? {
            display_name: `${lead.first_name ?? ''} ${(lead.last_name ?? '')[0] ?? ''}`.trim(),
            loan_amount: lead.loan_amount != null ? Number(lead.loan_amount) : null,
            stage: lead.stage,
          }
        : null,
    };
  });

  return NextResponse.json({ alerts });
}
