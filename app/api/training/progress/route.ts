import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeRole } from '@/lib/navigation/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — manager compliance view: per-LO completion of REQUIRED training items.
export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const r = normalizeRole(role);
  if (r !== 'admin' && r !== 'branch_manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: required }, { data: members }] = await Promise.all([
    sb.from('training_items').select('id, title').eq('org_id', orgId).eq('is_required', true).eq('is_published', true).order('created_at'),
    sb.from('profiles').select('id, first_name, last_name').eq('org_id', orgId).eq('active', true).order('first_name'),
  ]);

  const requiredItems = required ?? [];
  const requiredIds = new Set(requiredItems.map((i) => i.id as string));

  const completedByUser: Record<string, Set<string>> = {};
  if (requiredIds.size > 0) {
    const { data: comps } = await sb
      .from('training_item_completions')
      .select('training_item_id, user_id')
      .eq('org_id', orgId)
      .in('training_item_id', Array.from(requiredIds));
    for (const c of comps ?? []) {
      const uid = c.user_id as string;
      (completedByUser[uid] ??= new Set()).add(c.training_item_id as string);
    }
  }

  const rows = (members ?? []).map((m) => {
    const done = completedByUser[m.id as string] ?? new Set<string>();
    return {
      user_id: m.id,
      name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Teammate',
      completed_ids: Array.from(done),
      completed_count: done.size,
      rate: requiredIds.size ? Math.round((done.size / requiredIds.size) * 100) : 100,
    };
  });

  return NextResponse.json({ required_items: requiredItems, members: rows });
}
