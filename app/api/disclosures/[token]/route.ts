/**
 * Phase 148 — public borrower disclosure view/acknowledge (token-gated, no login).
 *   GET  → the issued Loan Estimate for this token (marks delivered on first view)
 *   POST → record the borrower's acknowledgment
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: pkg } = await sb.from('disclosure_packages')
    .select('id, org_id, lead_id, status, le_data, issued_at, acknowledged_at')
    .eq('delivery_token', params.token).maybeSingle();
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Mark delivered on first borrower view.
  if (pkg.status === 'issued') {
    await sb.from('disclosure_packages').update({ status: 'delivered', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', pkg.id).then(() => undefined, () => undefined);
  }
  const [{ data: lead }, { data: org }] = await Promise.all([
    sb.from('leads').select('first_name').eq('id', pkg.lead_id).maybeSingle(),
    sb.from('organizations').select('name').eq('id', pkg.org_id).maybeSingle(),
  ]);
  return NextResponse.json({
    le: pkg.le_data, status: pkg.acknowledged_at ? 'acknowledged' : 'delivered',
    acknowledged_at: pkg.acknowledged_at,
    borrower_first_name: (lead as { first_name?: string } | null)?.first_name ?? null,
    company: (org as { name?: string } | null)?.name ?? null,
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: pkg } = await sb.from('disclosure_packages').select('id, acknowledged_at').eq('delivery_token', params.token).maybeSingle();
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (pkg.acknowledged_at) return NextResponse.json({ ok: true, already: true });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  await sb.from('disclosure_packages').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_ip: ip, updated_at: new Date().toISOString() }).eq('id', pkg.id);
  return NextResponse.json({ ok: true });
}
