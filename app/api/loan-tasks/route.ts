/**
 * Phase 45.2 — staff loan tasks.
 *   GET  ?scope=mine|all       → list (mine = assigned to me, open)
 *   POST                       → create / delegate a task
 *   PATCH                      → update status, flag-for-LO, reassign (body.id)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS = ['open', 'in_progress', 'waiting_on_borrower', 'completed', 'cancelled'];

async function myProfileId(sb: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const scope = new URL(req.url).searchParams.get('scope') ?? 'all';
  const sb = createAdminClient();
  let q = sb.from('loan_tasks').select('*, leads(first_name, last_name, loan_amount)').eq('org_id', orgId).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false }).limit(400);
  if (scope === 'mine') {
    const pid = await myProfileId(sb, userId);
    q = q.eq('assigned_to', pid ?? '00000000-0000-0000-0000-000000000000');
  }
  const { data } = await q;
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.lead_id || !b.title) return NextResponse.json({ error: 'lead_id and title are required' }, { status: 400 });
  const sb = createAdminClient();
  const creator = await myProfileId(sb, userId);
  const { data, error } = await sb.from('loan_tasks').insert({
    lead_id: String(b.lead_id), org_id: orgId, created_by: creator,
    assigned_to: b.assigned_to ? String(b.assigned_to) : null,
    title: String(b.title), description: b.description ? String(b.description) : null,
    due_date: b.due_date ? String(b.due_date) : null,
    priority: ['urgent', 'normal', 'low'].includes(String(b.priority)) ? String(b.priority) : 'normal',
    source: 'manual',
  }).select('*').single();
  if (error) { console.error('[loan-tasks] insert', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sb = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.status === 'string' && STATUS.includes(b.status)) {
    patch.status = b.status;
    if (b.status === 'completed') { patch.completed_at = new Date().toISOString(); patch.completed_by = await myProfileId(sb, userId); }
  }
  if (typeof b.flag_for_lo === 'boolean') patch.requires_lo = b.flag_for_lo;
  if ('assigned_to' in b) patch.assigned_to = b.assigned_to ? String(b.assigned_to) : null;
  await sb.from('loan_tasks').update(patch).eq('id', String(b.id)).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
