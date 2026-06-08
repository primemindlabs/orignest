import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/dialer/queue — uncontacted / early-stage leads with phone numbers.
export async function GET(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data, error } = await sb
    .from('leads')
    .select('id, first_name, last_name, phone, stage, first_contacted_at, created_at')
    .eq('org_id', org.id)
    .in('stage', ['new_inquiry', 'pre_qualified', 'application_started'])
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const twilioNumber = process.env.TWILIO_PHONE_NUMBER ?? null;
  return NextResponse.json({ leads: data ?? [], twilioNumber });
}
