/**
 * Phase 100 — POST /api/marketing/market-update/[id]/send
 * Body { realtor_ids: string[] }. Sends the update to the selected realtors via
 * the app's compliant email path (CAN-SPAM footer enforced), logs each send, and
 * marks the update sent. Skips unsubscribed realtors and those without email.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCompliantEmail, FROM_EMAIL } from '@/lib/resend';
import { buildMarketUpdateEmail } from '@/lib/email/marketUpdateTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { realtor_ids?: string[] };
  const ids = Array.isArray(b.realtor_ids) ? b.realtor_ids : [];
  if (ids.length === 0) return NextResponse.json({ error: 'No realtors selected' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, first_name, last_name, nmls_id, phone, avatar_url').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: update } = await sb.from('realtor_market_updates').select('*').eq('id', params.id).eq('org_id', orgId).eq('lo_id', profile.id).maybeSingle();
  if (!update) return NextResponse.json({ error: 'Update not found' }, { status: 404 });

  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const loName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Your Loan Officer';

  const { data: realtors } = await sb
    .from('realtors')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId).in('id', ids)
    .eq('unsubscribed_market_update', false)
    .not('email', 'is', null);

  const weekOfLabel = new Date(update.week_of as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const points = Array.isArray(update.talking_points) ? (update.talking_points as string[]) : [];

  let sent = 0;
  const results: { realtor_id: string; success: boolean; error?: string }[] = [];

  for (const r of realtors ?? []) {
    if (!r.email) continue;
    const html = buildMarketUpdateEmail({
      lo_name: loName,
      lo_nmls: profile.nmls_id ?? '',
      lo_company: org?.name ?? '',
      lo_phone: profile.phone ?? '',
      lo_photo_url: profile.avatar_url ?? '',
      realtor_first_name: r.first_name ?? 'there',
      week_of: weekOfLabel,
      rate_30yr_conv: Number(update.rate_30yr_conv ?? 0),
      rate_15yr_conv: Number(update.rate_15yr_conv ?? 0),
      rate_30yr_fha: Number(update.rate_30yr_fha ?? 0),
      rate_30yr_va: Number(update.rate_30yr_va ?? 0),
      market_summary: update.market_summary as string,
      talking_points: points,
      unsubscribe_link: `${APP_URL}/api/marketing/market-update/unsubscribe?realtor=${r.id}&update=${update.id}`,
    });

    try {
      const result = await sendCompliantEmail({
        from: `${loName} <${FROM_EMAIL}>`,
        to: r.email,
        recipientEmail: r.email,
        orgId,
        subject: `Market Update: Week of ${new Date(update.week_of as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        html,
      });
      await sb.from('realtor_market_update_sends').insert({
        org_id: orgId, update_id: update.id, realtor_id: r.id, sent_at: new Date().toISOString(), resend_id: result?.id ?? null,
      });
      sent += 1;
      results.push({ realtor_id: r.id, success: true });
    } catch (err) {
      console.error('[market-update] send failed', err);
      results.push({ realtor_id: r.id, success: false, error: err instanceof Error ? err.message : 'send_failed' });
    }
  }

  await sb.from('realtor_market_updates').update({ status: 'sent', sent_at: new Date().toISOString(), total_recipients: sent }).eq('id', update.id);

  return NextResponse.json({ sent, results });
}
