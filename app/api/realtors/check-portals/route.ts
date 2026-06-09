/**
 * Phase 31.2b — realtor split-loyalty awareness. Returns ONLY a count of OTHER
 * orgs this realtor has a portal with — no org/LO identity. Informational.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) return NextResponse.json({ has_other_portals: false, portal_count: 0 });

  const sb = createAdminClient();
  const { data, error } = await sb.rpc('check_realtor_other_portals', { p_email: email, p_org_id: orgId });
  if (error) {
    console.error('[check-portals] rpc failed', error);
    return NextResponse.json({ has_other_portals: false, portal_count: 0 });
  }
  const result = (data as { has_other_portals?: boolean; portal_count?: number }) ?? {};

  if (result.has_other_portals) {
    await sb.from('tenant_isolation_events').insert({
      org_id: orgId,
      event_type: 'realtor_other_portals_notice',
      detail: { portal_count: result.portal_count ?? 0 },
    }).then(() => undefined, () => undefined);
  }

  return NextResponse.json({ has_other_portals: Boolean(result.has_other_portals), portal_count: result.portal_count ?? 0 });
}
