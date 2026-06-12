import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureDefaultChannels, visibleChannels } from '@/lib/teamChat/channels';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — bootstrap the chat workspace: visible channels + team members (for @mentions)
// + recent loans (for the loan-context picker). Lazily seeds the default channels.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  await ensureDefaultChannels(sb, orgId);

  const [{ data: channels }, { data: memberRows }, { data: members }, { data: loans }] = await Promise.all([
    sb.from('team_channels').select('id, name, description, channel_type, is_default').eq('org_id', orgId).order('is_default', { ascending: false }).order('name'),
    sb.from('team_channel_members').select('channel_id').eq('user_id', me),
    sb.from('profiles').select('id, first_name, last_name, avatar_url, role').eq('org_id', orgId).eq('active', true).order('first_name'),
    sb.from('leads').select('id, first_name, last_name, stage').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
  ]);

  const memberChannelIds = new Set((memberRows ?? []).map((m) => m.channel_id as string));
  const visible = visibleChannels(channels ?? [], memberChannelIds);

  return NextResponse.json({ channels: visible, members: members ?? [], loans: loans ?? [], me });
}

// POST — create a channel. Any member can create one; private channels can seed members.
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const channelType = b.channel_type === 'private' || b.channel_type === 'dm' ? (b.channel_type as string) : 'public';

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: channel, error } = await sb
    .from('team_channels')
    .insert({
      org_id: orgId,
      name,
      description: b.description ? String(b.description).slice(0, 200) : null,
      channel_type: channelType,
      created_by: me,
    })
    .select('id, name, description, channel_type, is_default')
    .single();
  if (error || !channel) {
    console.error('[team-chat/channels POST]', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // Creator joins; for private channels, optionally seed additional members.
  const memberIds = new Set<string>([me]);
  if (channelType !== 'public' && Array.isArray(b.member_ids)) {
    for (const id of b.member_ids) if (typeof id === 'string') memberIds.add(id);
  }
  await sb.from('team_channel_members').insert(
    Array.from(memberIds).map((id) => ({ channel_id: channel.id, user_id: id, org_id: orgId })),
  );

  return NextResponse.json({ channel }, { status: 201 });
}
