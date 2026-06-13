import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { captureLeadAttribution, hasAttribution } from '@/lib/leads/attribution';

export const dynamic = 'force-dynamic';

const LOAN_TYPES = [
  'conventional', 'fha', 'va', 'usda', 'jumbo',
  'non_qm', 'heloc', 'construction', 'reverse', 'commercial', 'dscr',
];
const LOAN_PURPOSES = [
  'purchase', 'rate_term_refinance', 'cash_out_refinance', 'heloc', 'construction',
];
const STAGES = [
  'new_inquiry', 'pre_qual', 'application', 'processing',
  'underwriting', 'conditional_approval', 'clear_to_close',
];

// GET /api/leads?search=<query>
// Searchable lead lookup for the pre-approval & scenario lead selectors.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') ?? '').trim();

  let query = sb
    .from('leads')
    .select('id, first_name, last_name, email, stage')
    .eq('org_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}

// POST /api/leads — create a new lead (Phase 1.3 create flow).
// Required: first_name, last_name, email. TCPA: SMS consent is only recorded
// when explicitly granted, with timestamp + IP + consent language captured.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const firstName = str(body.first_name);
  const lastName = str(body.last_name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone) || null;

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: 'First name, last name, and email are required.' },
      { status: 422 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 422 });
  }

  const loanType = LOAN_TYPES.includes(str(body.loan_type)) ? str(body.loan_type) : null;
  const loanPurpose = LOAN_PURPOSES.includes(str(body.loan_purpose)) ? str(body.loan_purpose) : null;
  const stage = STAGES.includes(str(body.stage)) ? str(body.stage) : 'new_inquiry';
  const loanAmountRaw = Number(body.loan_amount);
  const loanAmount = Number.isFinite(loanAmountRaw) && loanAmountRaw > 0 ? loanAmountRaw : null;
  const leadSource = str(body.lead_source) || null;
  // Phase 98 — structured referral source for ROI analytics.
  const REFERRAL_SOURCES = ['realtor', 'zillow', 'meta_ads', 'google_ads', 'referral', 'organic', 'other'];
  const referralSource = REFERRAL_SOURCES.includes(str(body.referral_source)) ? str(body.referral_source) : null;
  const referralSourceDetail = referralSource ? (str(body.referral_source_detail) || null) : null;

  const sb = createAdminClient();

  // Assign to the creating user's profile when available.
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const insert: Record<string, unknown> = {
    org_id: orgId,
    assigned_to: profile?.id ?? null,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    loan_type: loanType,
    loan_purpose: loanPurpose,
    loan_amount: loanAmount,
    lead_source: leadSource,
    referral_source: referralSource,
    referral_source_detail: referralSourceDetail,
    stage,
  };

  // Phase 39.1 — data ownership (defaults to company_generated at the DB level).
  if (['lo_personal', 'company_generated', 'company_referral'].includes(String(body.data_ownership))) {
    insert.data_ownership = body.data_ownership;
  }
  if (str(body.ownership_notes)) insert.ownership_notes = str(body.ownership_notes);

  // TCPA — only record consent when the user affirmatively granted it.
  if (body.sms_consent === true && phone) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    insert.sms_consent = true;
    insert.sms_consent_obtained_at = new Date().toISOString();
    insert.sms_consent_ip = ip;
    insert.sms_consent_text =
      'Borrower agreed to receive SMS messages about their loan from this brokerage. Msg & data rates may apply. Reply STOP to opt out.';
  }

  const { data, error } = await sb
    .from('leads')
    .insert(insert)
    .select('id, first_name, last_name')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase 99 — initial stage_transitions audit row (from_stage = null).
  if (data?.id) {
    const { logStageTransition } = await import('@/lib/funnel/logTransition');
    await logStageTransition(sb, { orgId, leadId: data.id, loId: profile?.id ?? null, fromStage: null, toStage: stage });
  }

  // Speed-to-lead — alert the assigned LO instantly so they can respond first.
  if (data?.id && profile?.id) {
    try {
      const { notify } = await import('@/lib/notifications/notify');
      await notify(sb, {
        orgId,
        userId: profile.id,
        type: 'system',
        title: `New lead — respond now: ${`${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()}`,
        body: 'The fastest response usually wins the loan. Tap to call or text.',
        link: '/speed-to-lead',
        urgency: 1,
      });
    } catch { /* non-blocking */ }
  }

  // Phase 33.2 — record ad attribution if UTM / click-id signals are present.
  const attribution = captureLeadAttribution(body as Record<string, unknown>);
  if (data?.id && hasAttribution(attribution)) {
    await sb.from('lead_ad_attribution').insert({
      lead_id: data.id,
      org_id: orgId,
      platform: attribution.platform ?? null,
      campaign_id: attribution.campaign_id ?? null,
      utm_source: attribution.utm_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign: attribution.utm_campaign ?? null,
    }).then(() => undefined, () => undefined);
  }

  return NextResponse.json({ lead: data }, { status: 201 });
}
