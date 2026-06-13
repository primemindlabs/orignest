// Compliance Shield — surfaces the org's existing TCPA / TRID / NMLS posture as a single
// trust dashboard (the branch/lender buying argument). Read-only aggregation of audit data.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const c = async (q: any): Promise<number> => { const { count } = await q; return count ?? 0; };

export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!['admin', 'branch_manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = createAdminClient();
  const head = { count: 'exact' as const, head: true };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [consentsOnFile, optOutsHonored, consentEvents30d, tridCompliant, tridBreaches] = await Promise.all([
    c(sb.from('leads').select('id', head).eq('org_id', orgId).eq('sms_consent', true)),
    c(sb.from('sms_opt_outs').select('id', head).eq('org_id', orgId)),
    c(sb.from('consent_audit_log').select('id', head).eq('org_id', orgId).gte('occurred_at', since)),
    c(sb.from('trid_events').select('id', head).eq('org_id', orgId).eq('is_compliant', true)),
    c(sb.from('trid_events').select('id', head).eq('org_id', orgId).eq('is_compliant', false)),
  ]);

  const tridTotal = tridCompliant + tridBreaches;
  const tridOnTimePct = tridTotal > 0 ? Math.round((tridCompliant / tridTotal) * 100) : null;

  // Recent immutable audit trail (consent events + admin actions), newest first.
  const [{ data: consentTrail }, { data: adminTrail }] = await Promise.all([
    sb.from('consent_audit_log').select('event_type, channel, source, occurred_at').eq('org_id', orgId).order('occurred_at', { ascending: false }).limit(10),
    sb.from('admin_audit_log').select('action, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
  ]);

  const trail = [
    ...(consentTrail ?? []).map((t) => ({ kind: 'consent', label: `${t.event_type}${t.channel ? ` · ${t.channel}` : ''}`, at: t.occurred_at as string })),
    ...(adminTrail ?? []).map((t) => ({ kind: 'admin', label: t.action as string, at: t.created_at as string })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12);

  return NextResponse.json({
    tcpa: { consentsOnFile, optOutsHonored, consentEvents30d },
    trid: { onTimePct: tridOnTimePct, compliant: tridCompliant, breaches: tridBreaches, total: tridTotal },
    trail,
  });
}
