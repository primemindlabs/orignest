import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwner } from '@/lib/lenderAe/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ aeId: string }> };

// POST — log a loan submission to this AE, then refresh the connection's denormalized
// last_submission_at + average response time from the (INSERT-only) submission log.
export async function POST(req: Request, { params }: Ctx) {
  const { aeId } = await params;
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { me, seesAll } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  let ownQ = sb.from('lender_ae_connections').select('id').eq('id', aeId).eq('org_id', orgId);
  if (!seesAll) ownQ = ownQ.eq('lo_id', me);
  if (!(await ownQ.maybeSingle()).data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const outcomes = ['approved', 'suspended', 'denied', 'withdrawn', 'pending'];
  const { error } = await sb.from('ae_submission_log').insert({
    org_id: orgId,
    ae_id: aeId,
    lo_id: me,
    loan_id: typeof b.loan_id === 'string' ? b.loan_id : null,
    loan_type: b.loan_type ? String(b.loan_type) : null,
    loan_amount: typeof b.loan_amount === 'number' ? b.loan_amount : null,
    first_response_at: typeof b.first_response_at === 'string' ? b.first_response_at : null,
    outcome: outcomes.includes(String(b.outcome)) ? String(b.outcome) : 'pending',
  });
  if (error) {
    console.error('[log-submission POST]', error);
    return NextResponse.json({ error: 'log_failed' }, { status: 500 });
  }

  // Recompute denormalized stats from the log (avoids a cron; cheap per-write).
  const { data: rows } = await sb.from('ae_submission_log').select('response_hours').eq('ae_id', aeId);
  const hours = (rows ?? []).map((r) => r.response_hours).filter((h): h is number => typeof h === 'number');
  const avg = hours.length ? Math.round((hours.reduce((a, h) => a + h, 0) / hours.length) * 10) / 10 : null;
  await sb
    .from('lender_ae_connections')
    .update({ last_submission_at: new Date().toISOString(), response_time_avg_hours: avg, updated_at: new Date().toISOString() })
    .eq('id', aeId);

  return NextResponse.json({ ok: true, response_time_avg_hours: avg }, { status: 201 });
}
