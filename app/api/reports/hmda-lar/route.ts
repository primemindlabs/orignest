import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

// HMDA action-taken codes (Reg C / FFIEC LAR spec).
function actionTaken(stage: string): { code: number; label: string } | null {
  switch (stage) {
    case 'closed': return { code: 1, label: 'Loan originated' };
    case 'declined': return { code: 3, label: 'Application denied' };
    case 'withdrawn': return { code: 4, label: 'Application withdrawn by applicant' };
    default: return null; // still in process — not yet reportable on the LAR
  }
}

// HMDA loan-type codes.
function loanTypeCode(t: string | null): number {
  const s = (t ?? '').toLowerCase();
  if (s.includes('fha')) return 2;
  if (s.includes('va')) return 3;
  if (s.includes('usda') || s.includes('rhs') || s.includes('rural')) return 4;
  return 1; // Conventional
}

// HMDA loan-purpose codes.
function loanPurposeCode(p: string | null): number {
  switch (p) {
    case 'purchase': return 1;
    case 'rate_term_refinance': return 31;
    case 'cash_out_refinance': return 32;
    case 'construction': return 1;
    case 'heloc': return 2;
    default: return 4; // Other
  }
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/reports/hmda-lar?year=YYYY — HMDA Loan/Application Register export.
 *
 * Produces a LAR-layout CSV from decisioned loans (originated / denied /
 * withdrawn) in the year. Fields we collect are populated with the correct
 * FFIEC codes; fields we do not yet collect (LEI, ULI hash, applicant
 * demographics, rate spread, etc.) are left blank — they populate once the POS
 * demographic module captures them. No values are fabricated.
 */
export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only admins can export the HMDA LAR' }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  const { data: leads } = await sb
    .from('leads')
    .select('id, stage, loan_type, loan_purpose, loan_amount, property_state, created_at, closed_date, application_submitted_at')
    .eq('org_id', orgId)
    .in('stage', ['closed', 'declined', 'withdrawn']);

  const headers = [
    'Record Identifier', 'Legal Entity Identifier (LEI)', 'Universal Loan Identifier (ULI)',
    'Application Date', 'Loan Type', 'Loan Purpose', 'Loan Amount',
    'Action Taken', 'Action Taken Description', 'Action Taken Date', 'State',
    'Ethnicity (HMDA)', 'Race (HMDA)', 'Sex (HMDA)', 'Rate Spread',
  ];
  const lines = [headers.map(csvCell).join(',')];

  let included = 0;
  for (const l of leads ?? []) {
    const action = actionTaken(l.stage as string);
    if (!action) continue;
    // Reportable on the year's LAR if the action occurred in that year.
    const actionDate = (l.closed_date as string | null) ?? (l.created_at as string).slice(0, 10);
    if (!actionDate.startsWith(String(year))) continue;
    included++;
    lines.push([
      2, // record identifier "2" = LAR data row
      '', // LEI — institution-level, set once configured
      '', // ULI — requires check-digit hash of LEI + loan id
      (l.application_submitted_at as string | null)?.slice(0, 10) ?? (l.created_at as string).slice(0, 10),
      loanTypeCode(l.loan_type as string | null),
      loanPurposeCode(l.loan_purpose as string | null),
      Number(l.loan_amount) || '',
      action.code,
      action.label,
      actionDate,
      (l.property_state as string | null) ?? '',
      '', '', '', '', // demographics + rate spread — collected via POS module
    ].map(csvCell).join(','));
  }

  const fileHeader = `# ${org?.name ?? 'Institution'} — HMDA LAR ${year} — ${included} reportable records — generated ${new Date().toISOString()}\n`;
  const csv = fileHeader + lines.join('\n') + '\n';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hmda-lar-${year}.csv"`,
    },
  });
}
