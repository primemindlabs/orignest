// Phase 88 — team-chat channel helpers. Default channels are seeded lazily on first
// load of an org (mirrors the Phase 31 getOrCreateThread pattern) rather than in the
// migration, since channels are per-org and need real data to exist first.

import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_CHANNELS: { name: string; description: string; channel_type: 'public' | 'private' }[] = [
  { name: 'general', description: 'Company-wide announcements and chatter', channel_type: 'public' },
  { name: 'pipeline', description: 'Loan pipeline coordination', channel_type: 'public' },
  { name: 'compliance', description: 'Compliance questions and guidance', channel_type: 'public' },
  { name: 'processors', description: 'Processing & ops team', channel_type: 'private' },
];

// Roles auto-added to the private "processors" channel on seed.
const PROCESSOR_ROLES = ['processor', 'loa', 'underwriter', 'admin', 'branch_manager'];

/**
 * Ensure the default channels exist for an org. No-op if any channel already exists.
 * Returns nothing; callers re-query channels afterward.
 */
export async function ensureDefaultChannels(sb: SupabaseClient<any, any, any>, orgId: string): Promise<void> {
  const { data: existing } = await sb.from('team_channels').select('id').eq('org_id', orgId).limit(1);
  if (existing && existing.length > 0) return;

  const { data: created } = await sb
    .from('team_channels')
    .insert(DEFAULT_CHANNELS.map((c) => ({ ...c, org_id: orgId, is_default: true })))
    .select('id, name, channel_type');
  if (!created) return;

  // Seed membership for the private processors channel so the right people see it.
  const processors = created.find((c) => c.name === 'processors');
  if (processors) {
    const { data: staff } = await sb
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .in('role', PROCESSOR_ROLES);
    if (staff && staff.length > 0) {
      await sb.from('team_channel_members').insert(
        staff.map((s) => ({ channel_id: processors.id, user_id: s.id, org_id: orgId })),
      );
    }
  }
}

/**
 * Channels the given profile can see in an org: every public channel, plus any
 * private/dm channel they're a member of. PURE given the two row sets.
 */
export function visibleChannels<T extends { id: string; channel_type: string }>(
  channels: T[],
  memberChannelIds: Set<string>,
): T[] {
  return channels.filter((c) => c.channel_type === 'public' || memberChannelIds.has(c.id));
}
