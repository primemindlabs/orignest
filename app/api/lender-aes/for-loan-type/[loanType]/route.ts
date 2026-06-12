import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwner } from '@/lib/lenderAe/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ loanType: string }> };

// GET — preferred AEs covering a loan type, fastest responders first. Consumed by the
// DSCR analyzer / deal-desk / scenario surfaces.
export async function GET(_req: Request, { params }: Ctx) {
  const { loanType } = await params;
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { me, seesAll } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  let q = sb
    .from('lender_ae_connections')
    .select('id, lender_name, ae_name, ae_email, ae_phone, ae_cell, preferred, response_time_avg_hours, last_submission_at, loan_types')
    .eq('is_active', true)
    .contains('loan_types', [loanType]);
  q = seesAll ? q.eq('org_id', orgId) : q.eq('lo_id', me);
  const { data: aes } = await q
    .order('preferred', { ascending: false })
    .order('response_time_avg_hours', { ascending: true, nullsFirst: false });

  return NextResponse.json({ aes: aes ?? [] });
}
