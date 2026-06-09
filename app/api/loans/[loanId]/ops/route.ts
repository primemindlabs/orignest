/**
 * Phase 52.3/52.5/52.8 — operational fields on a loan (lead): EMD, MERS, and
 * post-close first-payment details. PATCH whitelist; confirm_emd stamps the
 * confirmer + received date.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateMERSMin } from '@/lib/compliance/mersMin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = ['emd_amount', 'emd_due_date', 'emd_received_date', 'emd_notes', 'emd_held_by', 'emd_held_by_name', 'mers_min', 'mers_registered_date', 'mers_status', 'first_payment_date', 'loan_servicer_name', 'loan_servicer_payment_url', 'monthly_payment_amount'];

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.mers_min && !validateMERSMin(String(b.mers_min))) return NextResponse.json({ error: 'MERS MIN must be exactly 18 digits' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in b) patch[f] = b[f] === '' ? null : b[f];

  const sb = createAdminClient();
  if (b.confirm_emd === true) {
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    patch.emd_received_date = new Date().toISOString().slice(0, 10);
    patch.emd_received_confirmed_by = profile?.id ?? null;
  }
  await sb.from('leads').update(patch).eq('id', params.loanId).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
