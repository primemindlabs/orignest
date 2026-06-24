/**
 * Phase 148 — generate/issue a Loan Estimate for one loan ([loanId] = lead id).
 *   GET  → issued disclosure packages for this loan
 *   POST → { action: 'preview', fees } returns the computed LE without saving
 *          { action: 'issue',   fees } saves the package, mints a delivery token,
 *                                       and logs the le_issued TRID event
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { previewLoanEstimate, issueDisclosure } from '@/lib/disclosures/issue';
import type { FeeWorksheet } from '@/lib/disclosures/buildLoanEstimate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('disclosure_packages').select('id, package_type, status, delivery_token, issued_at, delivered_at, acknowledged_at, created_at').eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ packages: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { action?: string; fees?: FeeWorksheet };
  const fees = (b.fees ?? {}) as FeeWorksheet;
  const sb = createAdminClient();

  if (b.action === 'preview') {
    const le = await previewLoanEstimate(sb, orgId, params.loanId, fees);
    if (!le) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    return NextResponse.json({ le });
  }

  if (b.action === 'issue') {
    const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    const out = await issueDisclosure(sb, orgId, params.loanId, (prof as { id?: string } | null)?.id ?? null, fees);
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json({ ok: true, package: out.pkg });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
