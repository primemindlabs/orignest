import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PartnerPortalClient } from './PartnerPortalClient';

interface PortalData {
  partner: { name: string; company: string; type: string };
  lo: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    nmls_id: string | null;
    avatar_url: string | null;
    title: string | null;
  } | null;
  stats: { total: number; inPipeline: number; closed: number; totalVolume: string };
  leads: Array<{
    id: string;
    borrower: string;
    stage: string;
    daysInStage: number;
    closingDate: string | null;
    loanAmount: string | null;
    createdAt: string;
  }>;
}

export default async function PartnerPortalPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const sb = createAdminClient();

  // Validate token
  const { data: portalToken } = await sb
    .from('partner_portal_tokens')
    .select('id,org_id,partner_id,expires_at,active')
    .eq('token', token)
    .eq('active', true)
    .maybeSingle();

  if (!portalToken) notFound();
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) notFound();

  // Update last accessed
  await sb
    .from('partner_portal_tokens')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', portalToken.id);

  // Get partner info
  const { data: partner } = await sb
    .from('referral_partners')
    .select('id,contact_name,company_name,type')
    .eq('id', portalToken.partner_id)
    .single();

  if (!partner) notFound();

  // Get LO info
  const { data: los } = await sb
    .from('profiles')
    .select('first_name,last_name,email,phone,nmls_id,avatar_url,title')
    .eq('org_id', portalToken.org_id)
    .eq('is_active', true)
    .in('role', ['loan_officer', 'branch_manager'])
    .limit(1);

  const lo = los?.[0] ?? null;

  // Get referred leads (masked)
  const { data: leads } = await sb
    .from('leads')
    .select('id,first_name,last_name,stage,loan_amount,days_in_stage,closing_date,created_at')
    .eq('org_id', portalToken.org_id)
    .eq('referral_partner_id', portalToken.partner_id)
    .order('created_at', { ascending: false });

  const maskedLeads = (leads ?? []).map((l) => ({
    id: l.id,
    borrower: `${l.first_name} ${l.last_name.charAt(0)}.`,
    stage: l.stage,
    daysInStage: l.days_in_stage ?? 0,
    closingDate: l.closing_date ?? null,
    loanAmount: l.loan_amount ? `$${Math.round((l.loan_amount as number) / 1000)}K` : null,
    createdAt: l.created_at,
  }));

  const inPipeline = (leads ?? []).filter((l) => !['closed', 'dead'].includes(l.stage)).length;
  const closedCount = (leads ?? []).filter((l) => l.stage === 'closed').length;
  const totalVolume = (leads ?? [])
    .filter((l) => l.stage === 'closed')
    .reduce((s, l) => s + ((l.loan_amount as number) ?? 0), 0);

  const data: PortalData = {
    partner: { name: partner.contact_name, company: partner.company_name, type: partner.type },
    lo,
    stats: {
      total: (leads ?? []).length,
      inPipeline,
      closed: closedCount,
      totalVolume: `$${(totalVolume / 1_000_000).toFixed(1)}M`,
    },
    leads: maskedLeads,
  };

  return <PartnerPortalClient data={data} token={token} />;
}
