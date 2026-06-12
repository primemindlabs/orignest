import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeRole } from '@/lib/navigation/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/team-chat/export?channel_id=&from=&to= — admin-only compliance export of a
// channel's permanent message archive as CSV.
export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (normalizeRole(role) !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channel_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!channelId) return NextResponse.json({ error: 'channel_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: channel } = await sb
    .from('team_channels')
    .select('id, name')
    .eq('id', channelId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let q = sb
    .from('team_chat_messages')
    .select('created_at, body, lead_id, sender:profiles!team_chat_messages_user_id_fkey(first_name, last_name)')
    .eq('channel_id', channelId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const { data: rows } = await q;

  const header = ['timestamp', 'sender', 'message', 'loan_id'];
  const lines = [header.join(',')];
  for (const r of rows ?? []) {
    const sender = (r as { sender?: { first_name?: string; last_name?: string } | null }).sender;
    const name = sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() : '';
    lines.push([csvCell(r.created_at), csvCell(name), csvCell(r.body), csvCell(r.lead_id)].join(','));
  }
  const csv = lines.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="team-chat-${channel.name}-export.csv"`,
    },
  });
}
