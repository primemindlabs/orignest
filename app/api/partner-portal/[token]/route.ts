import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const sb = createAdminClient();

    // Validate token
    const { data: portalToken } = await sb
      .from('partner_portal_tokens')
      .select('id,org_id,partner_id,expires_at,active')
      .eq('token', token)
      .eq('active', true)
      .maybeSingle();

    if (!portalToken) {
      return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 });
    }

    if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Portal link has expired' }, { status: 410 });
    }

    // Update last accessed
    await sb
      .from('partner_portal_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', portalToken.id);

    // Get partner info
    const { data: partner } = await sb
      .from('referral_partners')
      .select('id,contact_name,company_name,type,email,phone,total_referrals,closed_referrals,total_volume')
      .eq('id', portalToken.partner_id)
      .single();

    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

    // Get LO info (first active LO in org)
    const { data: los } = await sb
      .from('profiles')
      .select('id,first_name,last_name,email,phone,nmls_id,avatar_url,title')
      .eq('org_id', portalToken.org_id)
      .eq('is_active', true)
      .in('role', ['loan_officer', 'branch_manager'])
      .limit(1);

    const lo = los?.[0] ?? null;

    // Get referred leads (masked PII — only first name + last initial, stage, dates)
    const { data: leads } = await sb
      .from('leads')
      .select('id,first_name,last_name,stage,loan_amount,days_in_stage,closing_date,created_at,ai_score')
      .eq('org_id', portalToken.org_id)
      .eq('referral_partner_id', portalToken.partner_id)
      .order('created_at', { ascending: false });

    const maskedLeads = (leads ?? []).map((l) => ({
      id: l.id,
      borrower: `${l.first_name} ${l.last_name.charAt(0)}.`,
      stage: l.stage,
      daysInStage: l.days_in_stage,
      closingDate: l.closing_date,
      loanAmount: l.loan_amount ? `$${Math.round(l.loan_amount / 1000)}K` : null,
      createdAt: l.created_at,
    }));

    // Stats
    const inPipeline = (leads ?? []).filter((l) => !['closed', 'dead'].includes(l.stage)).length;
    const closed = (leads ?? []).filter((l) => l.stage === 'closed').length;
    const totalVolume = (leads ?? [])
      .filter((l) => l.stage === 'closed')
      .reduce((s, l) => s + (l.loan_amount ?? 0), 0);

    return NextResponse.json({
      partner: {
        name: partner.contact_name,
        company: partner.company_name,
        type: partner.type,
      },
      lo,
      stats: {
        total: (leads ?? []).length,
        inPipeline,
        closed,
        totalVolume: `$${(totalVolume / 1_000_000).toFixed(1)}M`,
      },
      leads: maskedLeads,
    });
  } catch (err) {
    console.error('[partner-portal]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
