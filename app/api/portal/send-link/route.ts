import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { nmlsGate } from '@/lib/gates/clientFacingGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — recent leads with a phone, plus their SMS-consent status (drives the picker +
// the TCPA gate shown in the drawer).
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, phone, sms_consent, stage')
    .eq('org_id', orgId)
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ leads: leads ?? [] });
}

// POST — text a borrower their portal link. TCPA gate is mandatory (phone + sms_consent).
// Mints/reuses a borrower portal token, builds /status/<token>, and sends via Twilio when
// configured — otherwise records the intent (gated, never fabricates a send).
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const leadId = typeof b.leadId === 'string' ? b.leadId : '';
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // ── NMLS gate — borrower comms must carry the LO's NMLS # (RESPA/TRID) ───────
  if (!(await nmlsGate(sb, me))) {
    return NextResponse.json({ error: 'Add your NMLS number in Settings → Profile before sending borrower communications.' }, { status: 403 });
  }

  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, phone, sms_consent')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  // ── Mandatory TCPA gate — never bypass ──────────────────────────────────────
  if (!lead.phone) return NextResponse.json({ error: 'No phone number on file for this borrower.' }, { status: 422 });
  if (!lead.sms_consent) return NextResponse.json({ error: 'Borrower has not given SMS consent (TCPA). Capture consent first.' }, { status: 422 });

  // ── Mint or reuse the borrower portal token ─────────────────────────────────
  let token: string | null = null;
  const { data: existing } = await sb
    .from('borrower_portal_tokens')
    .select('token, expires_at')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .eq('participant_type', 'borrower')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && (!existing.expires_at || new Date(existing.expires_at as string) > new Date())) {
    token = existing.token as string;
  } else {
    const fresh = randomBytes(32).toString('hex');
    const { data: created } = await sb
      .from('borrower_portal_tokens')
      .insert({ lead_id: leadId, org_id: orgId, token: fresh, participant_type: 'borrower', expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString() })
      .select('token')
      .single();
    token = (created?.token as string | undefined) ?? null;
  }
  if (!token) return NextResponse.json({ error: 'Could not create portal link' }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const portalUrl = `${base}/status/${token}`;
  const body = `Hi ${lead.first_name ?? 'there'}! Your mortgage portal is ready — track your loan, upload documents, and message me anytime: ${portalUrl}`;

  // ── Gated Twilio send (record-only without creds) ───────────────────────────
  const live = process.env.PORTAL_LINK_LIVE === 'true' && Boolean(process.env.TWILIO_AUTH_TOKEN) && Boolean(process.env.TWILIO_ACCOUNT_SID);
  let delivery: 'sent' | 'recorded' | 'failed' = 'recorded';
  let errorMsg: string | null = null;
  if (live) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      await client.messages.create({ to: lead.phone as string, from: process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER, body });
      delivery = 'sent';
    } catch (e) {
      delivery = 'failed';
      errorMsg = e instanceof Error ? e.message : 'send failed';
      console.error('[portal/send-link twilio]', e);
    }
  }

  await sb.from('portal_link_sends').insert({
    org_id: orgId,
    lo_id: me,
    lead_id: leadId,
    recipient_phone: lead.phone as string,
    portal_token: token,
    delivery,
    error: errorMsg,
  });

  return NextResponse.json({ ok: delivery !== 'failed', delivery, portal_url: portalUrl, error: errorMsg }, { status: delivery === 'failed' ? 502 : 200 });
}
