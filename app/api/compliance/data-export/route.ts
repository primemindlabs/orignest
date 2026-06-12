/**
 * Phase 38 follow-up — CCPA data export (GET, Clerk-authenticated).
 *
 * Returns a JSON bundle of the requesting LO's data. Adapted to the real schema:
 * there is no `borrowers`/`loans`/`consent_audit_log` table — borrower + loan
 * records live on `leads`, and consent lives in tcpa_consent_log /
 * communication_consents. ashley_brain_* are queried best-effort (the module's
 * tables may not be provisioned yet). Scoped to the LO's own book (assigned_to)
 * within their org. One export per user per 24h; each request is logged to the
 * INSERT-only data_export_requests table.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

/** Best-effort fetch: returns [] if the table is missing or the query errors. */
async function safe<T = Record<string, unknown>>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    return error ? [] : data ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb: Admin = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, email, first_name, last_name')
    .eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  const profileId = profile.id as string;

  // ── Rate limit: one export per user per 24 hours ──────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('data_export_requests')
    .select('id, created_at')
    .eq('requested_by', profileId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'You can request one data export every 24 hours.', last_requested_at: recent[0].created_at },
      { status: 429 },
    );
  }

  // ── Gather the LO's records ───────────────────────────────────────────────
  // `leads` holds borrower + loan data in this schema.
  const leads = await safe(
    sb.from('leads').select('*').eq('org_id', orgId).eq('assigned_to', profileId).limit(10000),
  );
  const leadIds = leads.map((l) => (l as { id: string }).id);

  const communications = leadIds.length
    ? await safe(sb.from('communications').select('*').eq('org_id', orgId).in('lead_id', leadIds).limit(20000))
    : [];

  const tcpa_consent_log = leadIds.length
    ? await safe(sb.from('tcpa_consent_log').select('*').in('lead_id', leadIds).limit(20000))
    : [];
  const communication_consents = leadIds.length
    ? await safe(sb.from('communication_consents').select('*').in('lead_id', leadIds).limit(20000))
    : [];

  // ashley_brain_* may not be provisioned — best-effort by LO.
  const ashley_brain_memories = await safe(
    sb.from('ashley_brain_memories').select('*').eq('lo_id', profileId).limit(20000),
  );
  const ashley_brain_logs = await safe(
    sb.from('ashley_brain_logs').select('*').eq('lo_id', profileId).limit(20000),
  );

  const data = {
    // `leads` covers the spec's `borrowers` and `loans` (single table here).
    leads,
    communications,
    consent: { tcpa_consent_log, communication_consents },
    ashley_brain_memories,
    ashley_brain_logs,
  };

  const recordCount =
    leads.length + communications.length + tcpa_consent_log.length +
    communication_consents.length + ashley_brain_memories.length + ashley_brain_logs.length;

  // ── Log the export (INSERT-only audit) ────────────────────────────────────
  const now = new Date().toISOString();
  await sb.from('data_export_requests').insert({
    org_id: orgId,
    requested_by: profileId,
    export_type: 'ccpa_full',
    record_count: recordCount,
    status: 'completed',
    sent_at: now,
  });

  const bundle = {
    exported_at: now,
    user_id: profileId,
    user: { email: profile.email, first_name: profile.first_name, last_name: profile.last_name },
    record_count: recordCount,
    data,
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ashleyiq-data-export-${now.split('T')[0]}.json"`,
    },
  });
}
