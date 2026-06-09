/**
 * Phase 31.4e — chat compliance export (branch manager / admin / compliance only).
 * GET ?lead_id=&date_from=&date_to= → CSV of chat messages in the caller's org.
 * Financial data lives in separate tables and is never included here.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { permissionsFor } from '@/lib/permissions/accessMatrix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!permissionsFor(role).access_compliance) {
    return NextResponse.json({ error: 'Forbidden — compliance/manager access required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get('lead_id');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');

  const sb = createAdminClient();
  let q = sb
    .from('chat_messages')
    .select('id, thread_id, sender_type, content, visible_to, created_at, loan_chat_threads!inner(lead_id)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(10000);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', dateTo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 });

  let rows = data ?? [];
  if (leadId) rows = rows.filter((r: any) => r.loan_chat_threads?.lead_id === leadId);

  const header = ['thread_id', 'lead_id', 'sender_type', 'content', 'visible_to', 'created_at'];
  const lines = [header.join(',')];
  for (const r of rows as any[]) {
    lines.push([
      csvCell(r.thread_id),
      csvCell(r.loan_chat_threads?.lead_id),
      csvCell(r.sender_type),
      csvCell(r.content),
      csvCell((r.visible_to ?? []).join('|')),
      csvCell(r.created_at),
    ].join(','));
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="chat-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
