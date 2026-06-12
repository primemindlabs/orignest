// Phase 87 — canonical notification insert. Writes to the existing `notifications` event
// store (NOT a new notification_log): id, org_id, user_id(profile), type, title, body,
// link, urgency, is_read, ... Realtime + the bell read from here.

import type { SupabaseClient } from '@supabase/supabase-js';

export type NotifyType =
  | 'new_voicemail'
  | 'trid_alert'
  | 'ghost_alert'
  | 'refi_opportunity'
  | 'team_mention'
  | 'rate_lock'
  | 'system';

// Lower urgency number = more urgent (matches the notifications.urgency convention).
const URGENCY: Record<NotifyType, number> = {
  trid_alert: 1,
  rate_lock: 1,
  ghost_alert: 2,
  new_voicemail: 2,
  team_mention: 2,
  refi_opportunity: 3,
  system: 3,
};

export async function notify(
  sb: SupabaseClient<any, any, any>,
  input: {
    orgId: string;
    userId: string; // profiles.id
    type: NotifyType;
    title: string;
    body?: string | null;
    link?: string | null; // action href
    urgency?: number;
  },
): Promise<void> {
  try {
    await sb.from('notifications').insert({
      org_id: input.orgId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      urgency: input.urgency ?? URGENCY[input.type] ?? 2,
      is_read: false,
    });
  } catch (e) {
    // Notifications are best-effort — never block the originating action.
    console.error('[notify]', e);
  }
}
