/**
 * Phase 31.2a — anonymous cross-org active-application check.
 * Returns ONLY { has_active_elsewhere }. Never reveals the other org/LO/loan.
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
  if (!email) return NextResponse.json({ has_active_elsewhere: false });

  const sb = createAdminClient();
  const { data, error } = await sb.rpc('check_active_application', { p_email: email, p_org_id: orgId });
  if (error) {
    console.error('[check-active] rpc failed', error);
    return NextResponse.json({ has_active_elsewhere: false });
  }
  const hasActive = Boolean((data as { has_active_elsewhere?: boolean })?.has_active_elsewhere);

  // Audit the warning (no other-org identifying data — only that a warning fired).
  if (hasActive) {
    await sb.from('tenant_isolation_events').insert({
      org_id: orgId,
      event_type: 'active_application_warning',
      detail: { email_domain: email.split('@')[1] ?? null },
    }).then(() => undefined, () => undefined);
  }

  return NextResponse.json({ has_active_elsewhere: hasActive });
}
