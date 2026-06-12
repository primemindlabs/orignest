/**
 * Phase 94 — Arrive integration management (per-LO self-service, not org-wide).
 *   GET    → this LO's integration status + webhook URL + import count (no secret)
 *   POST   → connect/update: save Arrive Partner ID, mint webhook secret
 *   DELETE → disconnect: deactivate (config + import log preserved for audit)
 *
 * Each LO connects their OWN Arrive partner account, so there is no admin gate —
 * just an authenticated user with a resolved profile.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

async function resolveProfileId(userId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

function webhookUrl(loId: string): string {
  return `${APP_URL}/api/webhooks/arrive?lo=${loId}`;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const loId = await resolveProfileId(userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const sb = createAdminClient();
  const { data: integ } = await sb
    .from('arrive_integrations')
    .select('arrive_partner_id, is_active, created_at')
    .eq('lo_id', loId)
    .maybeSingle();
  const { count } = await sb
    .from('arrive_lead_imports')
    .select('id', { count: 'exact', head: true })
    .eq('lo_id', loId)
    .eq('import_status', 'imported');

  return NextResponse.json({
    connected: !!(integ && integ.is_active),
    integration: integ ?? null,
    webhook_url: integ ? webhookUrl(loId) : null,
    imported_count: count ?? 0,
  });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const loId = await resolveProfileId(userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { arrive_partner_id?: string; regenerate?: boolean };
  const partnerId = (b.arrive_partner_id ?? '').toString().trim();
  if (!partnerId) return NextResponse.json({ error: 'Arrive Partner ID is required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing } = await sb
    .from('arrive_integrations')
    .select('webhook_secret')
    .eq('lo_id', loId)
    .maybeSingle();
  const secret = b.regenerate || !existing?.webhook_secret ? randomBytes(24).toString('hex') : existing.webhook_secret;

  const { error } = await sb.from('arrive_integrations').upsert(
    {
      lo_id: loId,
      org_id: orgId,
      arrive_partner_id: partnerId,
      webhook_secret: secret,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lo_id' },
  );
  if (error) {
    console.error('[arrive] connect failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  // Secret returned ONCE so the LO can paste it into their Arrive dashboard.
  return NextResponse.json({
    connected: true,
    arrive_partner_id: partnerId,
    webhook_url: webhookUrl(loId),
    webhook_secret: secret,
  });
}

export async function DELETE() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const loId = await resolveProfileId(userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const sb = createAdminClient();
  // Deactivate (preserve config + import audit). Webhook then 200s silently.
  await sb
    .from('arrive_integrations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('lo_id', loId);
  return NextResponse.json({ ok: true });
}
