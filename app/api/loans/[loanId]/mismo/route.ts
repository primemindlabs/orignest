/**
 * GET /api/loans/[loanId]/mismo — download this loan's application as a MISMO 3.4
 * (ULAD) URLA XML file. Lender-agnostic: upload to any lender/AUS that ingests
 * MISMO 3.4. [loanId] is the lead id. Admin/LO scoped via org.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptPII } from '@/lib/compliance/encryption';
import { buildUrlaXml } from '@/lib/mismo/buildUrla';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function dec(ct?: string | null, iv?: string | null): Promise<string | undefined> {
  if (!ct || !iv) return undefined;
  try { return await decryptPII(ct, iv); } catch { return undefined; }
}

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('*').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: app } = await sb.from('loan_applications').select('*').eq('lead_id', params.loanId).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!app) return NextResponse.json({ error: 'No application on file — complete the 1003 first.' }, { status: 404 });

  const [ssn, dob, coSsn, coDob] = await Promise.all([
    dec(app.ssn_encrypted, app.ssn_iv), dec(app.dob_encrypted, app.dob_iv),
    dec(app.co_ssn_encrypted, app.co_ssn_iv), dec(app.co_dob_encrypted, app.co_dob_iv),
  ]);

  const xml = buildUrlaXml({ app, lead, pii: { ssn, dob, coSsn, coDob } });
  const name = `${(lead.last_name || 'loan')}_${params.loanId.slice(0, 8)}_URLA_MISMO34.xml`.replace(/[^A-Za-z0-9_.-]/g, '');

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
