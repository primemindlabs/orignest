// Phase 121 — one partner's referral history + update-email log.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { partnerId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ referrals: [], emails: [] });

  const sb = createAdminClient();
  const { data: partner } = await sb.from('referral_partners').select('id').eq('id', params.partnerId).eq('org_id', orgId).maybeSingle();
  if (!partner) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: referrals }, { data: emails }] = await Promise.all([
    sb.from('partner_referrals').select('*, lead:leads(id, first_name, last_name, stage)').eq('partner_id', params.partnerId).eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('partner_update_emails').select('*').eq('partner_id', params.partnerId).eq('org_id', orgId).order('sent_at', { ascending: false }).limit(50),
  ]);

  return NextResponse.json({ referrals: referrals ?? [], emails: emails ?? [] });
}
