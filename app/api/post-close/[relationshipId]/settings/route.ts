// Phase 103 — per-monitor settings: opt-out/pause + rate-drop threshold.
// Edits the existing borrower_relationships row (the monitor).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ relationshipId: string }> };

const STATUSES = ['active', 'paused', 'opted_out'];

export async function PATCH(req: Request, { params }: Ctx) {
  const { relationshipId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body?.monitoring_status !== undefined) {
    if (!STATUSES.includes(body.monitoring_status)) {
      return NextResponse.json({ error: 'Invalid monitoring_status' }, { status: 400 });
    }
    updates.monitoring_status = body.monitoring_status;
  }
  if (body?.rate_trigger_threshold !== undefined) {
    const t = Number(body.rate_trigger_threshold);
    if (!Number.isFinite(t) || t < 0.25 || t > 3) {
      return NextResponse.json({ error: 'Threshold must be 0.25–3' }, { status: 400 });
    }
    updates.refi_alert_threshold = t;
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from('borrower_relationships')
    .update(updates)
    .eq('id', relationshipId)
    .eq('org_id', orgId);
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
