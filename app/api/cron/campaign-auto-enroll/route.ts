/**
 * Phase 34.3 — date/inactivity-triggered auto-enrollment (cron-callable).
 * Enrolls matching leads into each org's active, auto_enroll campaign of the
 * given type. reactivation + loan_anniversary are functional; birthday and
 * pre_approval_expiring gate to empty (leads have no DOB / preapproval-expiry
 * columns in this schema) — noted, not faked.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { trigger_type } = (await req.json().catch(() => ({}))) as { trigger_type?: string };
  if (!trigger_type) return NextResponse.json({ error: 'trigger_type required' }, { status: 400 });

  const sb = createAdminClient();
  // Org campaigns of this type that opt into auto-enroll.
  const { data: campaigns } = await sb.from('campaigns').select('id, org_id').eq('type', trigger_type).eq('is_library_template', false).eq('status', 'active').eq('auto_enroll', true);
  if (!campaigns || campaigns.length === 0) return NextResponse.json({ ok: true, enrolled: 0, note: 'No auto-enroll campaigns of this type.' });

  let enrolled = 0;
  for (const c of campaigns) {
    let leadIds: string[] = [];
    if (trigger_type === 'reactivation') {
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const { data } = await sb.from('leads').select('id').eq('org_id', c.org_id).in('stage', ACTIVE_STAGES).lt('last_contacted_at', cutoff).is('archived_at', null).limit(500);
      leadIds = (data ?? []).map((l) => l.id);
    } else if (trigger_type === 'loan_anniversary') {
      const today = new Date();
      const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data } = await sb.from('leads').select('id, closed_date').eq('org_id', c.org_id).not('closed_date', 'is', null).limit(2000);
      leadIds = (data ?? []).filter((l) => l.closed_date && (l.closed_date as string).slice(5, 10) === mmdd).map((l) => l.id);
    } else {
      // birthday / pre_approval_expiring: no source column in this schema.
      continue;
    }
    if (leadIds.length === 0) continue;

    const { data: step1 } = await sb.from('campaign_steps').select('delay_days, delay_hours').eq('campaign_id', c.id).eq('step_number', 1).maybeSingle();
    const firstSend = new Date(Date.now() + (step1?.delay_days ?? 0) * 86_400_000 + (step1?.delay_hours ?? 0) * 3_600_000).toISOString();
    const { data: ins } = await sb.from('campaign_enrollments').upsert(
      leadIds.map((lead_id) => ({ campaign_id: c.id, lead_id, org_id: c.org_id, enrolled_by: 'auto', status: 'active', current_step: 1, next_send_at: firstSend })),
      { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true }
    ).select('id');
    enrolled += ins?.length ?? 0;
  }

  return NextResponse.json({ ok: true, trigger_type, enrolled });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
