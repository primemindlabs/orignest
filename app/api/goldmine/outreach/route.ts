// Phase 131 — POST: send a Goldmine outreach and mark it outreached.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoldmineAccess } from '@/lib/goldmine/access';
import { sendGoldmineOutreach } from '@/lib/goldmine/sendOutreach';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = createAdminClient();
  const acc = await getGoldmineAccess(sb);
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status });
  if (acc.locked) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

  const { opportunityId, channel } = (await req.json().catch(() => ({}))) as { opportunityId?: string; channel?: 'sms' | 'email' };
  if (!opportunityId || (channel !== 'sms' && channel !== 'email')) {
    return NextResponse.json({ error: 'opportunityId and channel (sms|email) required' }, { status: 400 });
  }

  const { data: opp } = await sb
    .from('goldmine_opportunities')
    .select('id, contact_id, draft_sms, draft_email_subject, draft_email_body')
    .eq('id', opportunityId)
    .eq('lo_id', acc.loId)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

  const result = await sendGoldmineOutreach(sb, opp as any, channel, acc.loId, acc.orgId);
  if (!result.ok) return NextResponse.json({ error: result.reason ?? 'Could not send' }, { status: 400 });

  await sb
    .from('goldmine_opportunities')
    .update({ status: 'outreached', last_updated: new Date().toISOString() })
    .eq('id', opportunityId)
    .eq('lo_id', acc.loId);

  return NextResponse.json({ ok: true });
}
