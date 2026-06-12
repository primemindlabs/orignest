import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId, getAccessibleChannel } from '@/lib/teamChat/access';
import { parseMentions } from '@/lib/teamChat/mentions';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ channelId: string }> };

interface MsgRow {
  id: string;
  body: string;
  lead_id: string | null;
  mentions: string[];
  parent_id: string | null;
  created_at: string;
  user_id: string;
  sender: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  lead: { id: string; first_name: string | null; last_name: string | null; stage: string | null } | null;
}

// GET — messages for a channel (polled every 5s by the client), with sender, optional
// loan context, and aggregated reactions.
export async function GET(_req: Request, { params }: Ctx) {
  const { channelId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const channel = await getAccessibleChannel(sb, channelId, orgId, me);
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: rawMessages } = await sb
    .from('team_chat_messages')
    .select(
      'id, body, lead_id, mentions, parent_id, created_at, user_id, ' +
        'sender:profiles!team_chat_messages_user_id_fkey(id, first_name, last_name, avatar_url), ' +
        'lead:leads!team_chat_messages_lead_id_fkey(id, first_name, last_name, stage)',
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(200);
  // supabase-js types embedded relationships as a union with GenericStringError; cast
  // through unknown to the known row shape.
  const messages = (rawMessages ?? []) as unknown as MsgRow[];

  const ids = messages.map((m) => m.id);
  let reactionsByMsg: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
  if (ids.length > 0) {
    const { data: reactions } = await sb
      .from('team_chat_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', ids);
    const agg: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions ?? []) {
      const mid = r.message_id as string;
      const emoji = r.emoji as string;
      agg[mid] ??= {};
      agg[mid][emoji] ??= { count: 0, mine: false };
      agg[mid][emoji].count += 1;
      if (r.user_id === me) agg[mid][emoji].mine = true;
    }
    reactionsByMsg = Object.fromEntries(
      Object.entries(agg).map(([mid, emap]) => [mid, Object.entries(emap).map(([emoji, v]) => ({ emoji, ...v }))]),
    );
  }

  const withReactions = messages.map((m) => ({ ...m, reactions: reactionsByMsg[m.id] ?? [] }));
  return NextResponse.json({ channel, messages: withReactions, me });
}

// POST — send a message. Parses @mentions server-side and fires a notification to each
// mentioned teammate. Messages are permanent (INSERT-only compliance records).
export async function POST(req: Request, { params }: Ctx) {
  const { channelId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const body = String(b.body ?? '').trim();
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });
  if (body.length > 2000) return NextResponse.json({ error: 'too long' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const channel = await getAccessibleChannel(sb, channelId, orgId, me);
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: members } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .eq('active', true);
  const mentions = parseMentions(body, members ?? []);

  const { data: message, error } = await sb
    .from('team_chat_messages')
    .insert({
      channel_id: channelId,
      org_id: orgId,
      user_id: me,
      body,
      lead_id: typeof b.lead_id === 'string' ? b.lead_id : null,
      parent_id: typeof b.parent_id === 'string' ? b.parent_id : null,
      mentions,
    })
    .select('id, body, lead_id, mentions, parent_id, created_at, user_id')
    .single();
  if (error || !message) {
    console.error('[team-chat/messages POST]', error);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  // Notify mentioned teammates (best-effort; never blocks the send). Skip self.
  const mentioned = mentions.filter((id) => id !== me);
  if (mentioned.length > 0) {
    const sender = (members ?? []).find((m) => m.id === me);
    const senderName = sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || 'A teammate' : 'A teammate';
    await Promise.all(
      mentioned.map((id) =>
        notify(sb, {
          orgId,
          userId: id,
          type: 'team_mention',
          title: `${senderName} mentioned you in #${channel.name}`,
          body: body.slice(0, 100),
          link: `/team-chat?c=${channelId}`,
        }),
      ),
    );
  }

  return NextResponse.json({ message }, { status: 201 });
}
