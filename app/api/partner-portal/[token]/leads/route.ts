import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const VALID_PURPOSES = ['purchase', 'rate_term_refinance', 'cash_out_refinance'];

// Token-authenticated partner referral submission. The token IS the auth.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: portal, error } = await sb
    .from('partner_portal_tokens')
    .select('partner_id, org_id, expires_at, active')
    .eq('token', params.token)
    .maybeSingle();

  if (error || !portal) {
    return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  }
  if (portal.active === false) {
    return NextResponse.json({ error: 'Portal link is no longer active' }, { status: 401 });
  }
  if (portal.expires_at && new Date(portal.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'Portal link has expired' }, { status: 401 });
  }

  const body = (await req.json()) as {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    property_address?: string;
    loan_purpose?: string;
    estimated_purchase_price?: number;
    notes?: string;
  };

  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim();

  if (!firstName || !lastName || !phone) {
    return NextResponse.json(
      { error: 'First name, last name, and phone are required' },
      { status: 400 }
    );
  }
  // leads.email is NOT NULL in this schema, so it is required here.
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const loanPurpose = body.loan_purpose && VALID_PURPOSES.includes(body.loan_purpose)
    ? body.loan_purpose
    : 'purchase';

  const { data: lead, error: leadError } = await sb
    .from('leads')
    .insert({
      org_id: portal.org_id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      lead_source: 'partner_referral',
      referral_partner_id: portal.partner_id,
      stage: 'new_inquiry',
      loan_purpose: loanPurpose,
      property_address: body.property_address?.trim() || null,
      estimated_value: body.estimated_purchase_price || null,
    })
    .select('id')
    .single();

  if (leadError || !lead) {
    console.error('[partner-referral] Lead insert error:', leadError?.message);
    return NextResponse.json({ error: 'Failed to submit referral' }, { status: 500 });
  }

  // Optional notes -> activity log (leads has no free-text notes column).
  const noteText = body.notes?.trim();
  await sb.from('lead_activities').insert({
    lead_id: lead.id,
    org_id: portal.org_id,
    action: 'partner_referral',
    description: noteText
      ? `Referral submitted via partner portal. Note: ${noteText}`
      : 'Referral submitted via partner portal',
    metadata: { source: 'partner_portal', partner_id: portal.partner_id, property_address: body.property_address?.trim() || null },
  });

  // Best-effort: bump the partner's referral counter.
  const { data: partner } = await sb
    .from('referral_partners')
    .select('first_name, last_name, company_name, referral_count')
    .eq('id', portal.partner_id)
    .maybeSingle();

  if (partner) {
    await sb
      .from('referral_partners')
      .update({ referral_count: (partner.referral_count as number ?? 0) + 1 })
      .eq('id', portal.partner_id);
  }

  const partnerName = partner
    ? `${partner.first_name as string} ${partner.last_name as string}`.trim() || (partner.company_name as string)
    : null;

  return NextResponse.json({
    success: true,
    lead_id: lead.id,
    message: `Referral submitted! ${partnerName ? `Thanks, ${partnerName}!` : 'Thank you!'} Your loan officer will be in touch within 24 hours.`,
  });
}
