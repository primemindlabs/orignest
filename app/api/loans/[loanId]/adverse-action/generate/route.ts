/**
 * Stage F-2 — generate an ECOA / Reg B adverse-action notice PDF for a loan.
 * POST { reasons: string[], actionTaken: 'denied'|'counteroffer'|'incomplete', scoreUsed?, scoreRange?, creditBureauName?, creditBureauPhone? }
 * Returns the PDF and records an adverse_action_notices row.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildAdverseActionNotice } from '@/lib/ecoa/buildAdverseActionNotice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = ['denied', 'counteroffer', 'incomplete'] as const;

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const reasons: string[] = Array.isArray(b.reasons) ? b.reasons.filter((r: unknown) => typeof r === 'string').slice(0, 4) : [];
  const actionTaken = ACTIONS.includes(b.actionTaken) ? b.actionTaken : 'denied';
  if (reasons.length === 0) return NextResponse.json({ error: 'At least one reason is required.' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('*').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const row = lead as Record<string, any>;
  const { data: org } = await sb.from('organizations').select('*').eq('id', orgId).maybeSingle();
  const o = (org ?? {}) as Record<string, any>;

  let loName = '';
  let loNmls = '';
  if (row.assigned_to) {
    const { data: lo } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('id', row.assigned_to).maybeSingle();
    if (lo) { loName = `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim(); loNmls = (lo as any).nmls_id ?? ''; }
  }

  const applicantAddress = [
    row.mailing_address ?? row.property_address,
    [row.mailing_city ?? row.property_city, row.mailing_state ?? row.property_state, row.mailing_zip ?? row.property_zip].filter(Boolean).join(', '),
  ].filter(Boolean).join(', ');

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const pdf = await buildAdverseActionNotice({
    applicantName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Applicant',
    applicantAddress,
    actionDate: today,
    lenderName: o.name ?? 'Lender',
    lenderAddress: o.address ?? process.env.COMPANY_PHYSICAL_ADDRESS ?? '',
    lenderPhone: o.phone ?? '',
    actionTaken,
    reasons,
    creditBureauName: b.creditBureauName,
    creditBureauPhone: b.creditBureauPhone,
    scoreUsed: typeof b.scoreUsed === 'number' ? b.scoreUsed : undefined,
    scoreRange: b.scoreRange,
    loanOfficerName: loName,
    loanOfficerNmls: loNmls,
  });

  await sb.from('adverse_action_notices').insert({
    lead_id: params.loanId, org_id: orgId, action_taken: actionTaken, reasons, generated_at: new Date().toISOString(),
  }).then(() => undefined, () => undefined); // best-effort log (table may be pending)

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="adverse-action-${params.loanId.slice(0, 8)}.pdf"`,
    },
  });
}
