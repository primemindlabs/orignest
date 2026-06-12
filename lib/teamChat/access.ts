// Phase 88 — shared team-chat access checks (used by every route).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TeamChannel {
  id: string;
  org_id: string;
  name: string;
  channel_type: string;
}

/** Resolve the caller's profiles.id from their Clerk user id. */
export async function getMyProfileId(sb: SupabaseClient<any, any, any>, clerkUserId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', clerkUserId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Return the channel if `profileId` may access it within `orgId` (public channels are
 * open to the org; private/dm require a membership row), otherwise null.
 */
export async function getAccessibleChannel(
  sb: SupabaseClient<any, any, any>,
  channelId: string,
  orgId: string,
  profileId: string,
): Promise<TeamChannel | null> {
  const { data: channel } = await sb
    .from('team_channels')
    .select('id, org_id, name, channel_type')
    .eq('id', channelId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!channel) return null;
  if (channel.channel_type === 'public') return channel as TeamChannel;

  const { data: member } = await sb
    .from('team_channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .eq('user_id', profileId)
    .maybeSingle();
  return member ? (channel as TeamChannel) : null;
}
