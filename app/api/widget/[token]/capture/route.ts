import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface WidgetLeadCapture {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  loanPurpose: 'purchase' | 'refinance' | 'cash_out_refi';
  propertyType: string;
  propertyValue?: number;
  downPayment?: number;
  creditScoreRange: string;
  annualIncome?: number;
  tcpaConsent: boolean;
  tcpaConsentText: string;
}

// Translate credit score range label to midpoint number
function parseCreditRange(range: string): number {
  const map: Record<string, number> = {
    '580-619': 599,
    '620-659': 639,
    '660-699': 679,
    '700-719': 709,
    '720-739': 729,
    '740-759': 749,
    '760+': 775,
  };
  return map[range] ?? 680;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const sb = createAdminClient();

    // Validate widget token
    const { data: widgetToken } = await sb
      .from('widget_tokens')
      .select('id,org_id,lo_id,active,leads_captured')
      .eq('token', token)
      .eq('active', true)
      .maybeSingle();

    if (!widgetToken) {
      return NextResponse.json({ error: 'Invalid widget token' }, { status: 404 });
    }

    const body = await req.json() as WidgetLeadCapture;
    const {
      firstName,
      lastName,
      email,
      phone,
      loanPurpose,
      propertyType,
      propertyValue,
      downPayment,
      creditScoreRange,
      annualIncome,
      tcpaConsent,
      tcpaConsentText,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ error: 'Name, email and phone are required' }, { status: 400 });
    }

    // Calculate loan amount from property value + down payment
    const estimatedLoanAmount =
      propertyValue && downPayment ? propertyValue - downPayment : undefined;

    const creditScore = parseCreditRange(creditScoreRange);

    // Create lead
    const { data: lead, error: leadError } = await sb
      .from('leads')
      .insert({
        org_id: widgetToken.org_id,
        assigned_to: widgetToken.lo_id ?? null,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        email,
        phone,
        loan_purpose: loanPurpose,
        property_type: propertyType as never,
        loan_amount: estimatedLoanAmount ?? null,
        estimated_credit_score: creditScore,
        annual_income: annualIncome ?? null,
        source: 'website',
        sms_consent: tcpaConsent,
        email_consent: tcpaConsent,
        voice_consent: false,
        consent_timestamp: tcpaConsent ? new Date().toISOString() : null,
        consent_method: tcpaConsent ? 'web_form' : null,
        stage: 'new_inquiry',
      })
      .select('id')
      .single();

    if (leadError || !lead) {
      console.error('[widget/capture]', leadError);
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }

    // Log TCPA consent if given
    if (tcpaConsent) {
      const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
      await sb.from('tcpa_consent_log').insert({
        lead_id: lead.id,
        org_id: widgetToken.org_id,
        recorded_by: 'widget_system',
        consent_method: 'web_form',
        sms_consent: true,
        email_consent: true,
        voice_consent: false,
        consent_text: tcpaConsentText,
        consent_timestamp: new Date().toISOString(),
        ip_address: ip,
        user_agent: req.headers.get('user-agent'),
      });
    }

    // Increment widget leads_captured
    await sb
      .from('widget_tokens')
      .update({ leads_captured: (widgetToken.leads_captured ?? 0) + 1 })
      .eq('id', widgetToken.id);

    // Log activity
    await sb.from('lead_activities').insert({
      lead_id: lead.id,
      org_id: widgetToken.org_id,
      action: 'lead_created',
      description: 'Lead captured via embeddable pre-qual widget',
      metadata: { source: 'widget', widget_token: token, credit_range: creditScoreRange },
    });

    // Trigger speed-to-contact automation (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';
    fetch(`${appUrl}/api/automations/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        triggerType: 'new_lead',
        payload: { source: 'widget' },
      }),
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: 'Your information has been received. A loan officer will contact you shortly.',
    });
  } catch (err) {
    console.error('[widget/capture]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
