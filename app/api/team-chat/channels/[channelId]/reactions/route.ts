import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId, getAccessibleChannel } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['👍', '✅', '🔑', '⚠️', '❓']);
type Ctx = { params: Promise<{ channelId: string }> };

// POST — toggle a reaction on a message. Reactions (unlike messages) are not
// compliance records, so removing your own reaction is allowed.
export async function POST(req: Request, { params }: Ctx) {
  const { channelId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const messageId = typeof b.message_id === 'string' ? b.message_id : '';
  const emoji = typeof b.emoji === 'string' ? b.emoji : '';
  if (!messageId || !ALLOWED.has(emoji)) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const channel = await getAccessibleChannel(sb, channelId, orgId, me);
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Confirm the message belongs to this channel before reacting.
  const { data: msg } = await sb
    .from('team_chat_messages')
    .select('id')
    .eq('id', messageId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: existing } = await sb
    .from('team_chat_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', me)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await sb.from('team_chat_reactions').delete().eq('message_id', messageId).eq('user_id', me).eq('emoji', emoji);
    return NextResponse.json({ reacted: false });
  }
  await sb.from('team_chat_reactions').insert({ message_id: messageId, user_id: me, emoji });
  return NextResponse.json({ reacted: true });
}
