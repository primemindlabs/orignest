/**
 * Phase 30.9 — Smart Document Checklist (LO-only). GET → AI checklist for the loan.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { generateChecklist } from '@/lib/ai/smartChecklist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const loan = await getLoanSummary(params.loanId);
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  try {
    const { items, cached } = await generateChecklist(loan.id, loan.context);
    return NextResponse.json({ items, cached });
  } catch (err) {
    console.error('[smart-checklist] failed', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }
}
