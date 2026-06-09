/**
 * Phase 56.3 — Plaid Link token for borrower-authorized bank-statement income
 * verification. GATED: the `plaid` SDK + PLAID_CLIENT_ID/PLAID_SECRET are not
 * provisioned, so this returns 501 (never fakes a token). Once configured, this
 * creates a link_token; the exchange route processes transactions IN MEMORY and
 * stores only the qualifying-income result (see lib/income/plaidAnalysis).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json({ gated: true, reason: 'Plaid is not configured (set PLAID_CLIENT_ID / PLAID_SECRET).' }, { status: 501 });
  }
  // When provisioned: plaid.linkTokenCreate({ user:{client_user_id: loanId}, products:['transactions'], ... }).
  return NextResponse.json({ gated: true, reason: 'Plaid SDK not installed in this deployment.' }, { status: 501 });
}
