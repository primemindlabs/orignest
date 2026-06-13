// Phase 121 — send a milestone update to a referring partner (one-click from loan detail).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPartnerUpdate, type PartnerUpdateType } from '@/lib/referralPartners/notify';

export const dynamic = 'force-dynamic';

const TYPES: PartnerUpdateType[] = ['referral_received', 'pre_approval', 'under_contract', 'funded'];

export async function POST(request: Request, { params }: { params: { partnerId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const type = (b.update_type ?? '').toString() as PartnerUpdateType;
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid update_type' }, { status: 400 });

  const sb = createAdminClient();
  const { data: partner } = await sb
    .from('referral_partners')
    .select('id, first_name, last_name, email')
    .eq('id', params.partnerId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!partner || !partner.email) return NextResponse.json({ error: 'Partner not found or has no email' }, { status: 404 });

  // LO identity (for NMLS + signature).
  const { data: lo } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle();

  // Borrower name: prefer an explicit lead, else a free-text name.
  let borrowerName = (b.borrower_name ?? '').toString().trim();
  const leadId = b.lead_id ? b.lead_id.toString() : null;
  if (leadId && !borrowerName) {
    const { data: lead } = await sb.from('leads').select('first_name, last_name').eq('id', leadId).eq('org_id', orgId).maybeSingle();
    if (lead) borrowerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  }
  if (!borrowerName) borrowerName = 'your referred client';

  const { sent } = await sendPartnerUpdate(sb, {
    orgId,
    partner: partner as { id: string; first_name: string; last_name: string; email: string },
    lo: { first_name: lo?.first_name ?? null, last_name: lo?.last_name ?? null, nmls_id: (lo?.nmls_id as string) ?? null },
    borrowerName,
    type,
    leadId,
  });

  return NextResponse.json({ ok: true, sent });
}
