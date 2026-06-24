/**
 * GET /api/loans/[loanId]/mismo — download this loan's application as a MISMO 3.4
 * (ULAD) URLA XML file. Lender-agnostic: upload to any lender/AUS that ingests
 * MISMO 3.4. [loanId] is the lead id. Admin/LO scoped via org.
 *
 * The application snapshot + PII decryption is shared with the wholesale-submission
 * layer via lib/mismo/loadUrlaInput, so the downloaded file and the file POSTed to
 * a lender are identical.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { buildUrlaForLoan } from '@/lib/mismo/loadUrlaInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const r = await buildUrlaForLoan(orgId, params.loanId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const name = `${(r.lead.last_name || 'loan')}_${params.loanId.slice(0, 8)}_URLA_MISMO34.xml`.replace(/[^A-Za-z0-9_.-]/g, '');
  return new NextResponse(r.xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
