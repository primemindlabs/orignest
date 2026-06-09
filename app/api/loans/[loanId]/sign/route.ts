/**
 * Phase 60.6 — loan signing surface.
 *   GET  → live TRID gate + this loan's sign envelopes
 *   POST → create a signing envelope (GATED until the Sign SDK + key are
 *          provisioned). For initial_disclosures, sending starts the TRID
 *          3-business-day clock; we never start that clock without a real send.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkTRIDGate } from '@/lib/sign/tridGate';
import { createEnvelope } from '@/lib/sign/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const [gate, { data: envelopes }] = await Promise.all([
    checkTRIDGate(orgId, params.loanId),
    sb.from('sign_envelopes').select('id, package_type, status, sent_at, completed_at, expires_at').eq('org_id', orgId).eq('loan_id', params.loanId).order('sent_at', { ascending: false }),
  ]);
  return NextResponse.json({ trid_gate: gate, envelopes: envelopes ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { package_type?: string };
  const pkg = b.package_type ?? 'other';

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const result = await createEnvelope({ title: `${pkg} envelope`, orgId, loId: profile?.id, packageType: pkg });
  if (result.gated) return NextResponse.json({ gated: true, reason: result.reason }, { status: 501 });

  // Provisioned path: record envelope + start TRID clock for initial disclosures.
  await sb.from('sign_envelopes').insert({ org_id: orgId, loan_id: params.loanId, envelope_id: result.envelope_id, package_type: pkg, status: 'sent', sent_by: profile?.id ?? null, expires_at: result.expires_at });
  if (pkg === 'initial_disclosures') {
    const now = new Date();
    const earliest = new Date(now); let added = 0; while (added < 3) { earliest.setDate(earliest.getDate() + 1); const d = earliest.getDay(); if (d !== 0 && d !== 6) added += 1; }
    await sb.from('leads').update({ loan_estimate_sent_at: now.toISOString(), earliest_consummation_date: earliest.toISOString().slice(0, 10) }).eq('id', params.loanId).eq('org_id', orgId);
  }
  return NextResponse.json({ envelope_id: result.envelope_id });
}
