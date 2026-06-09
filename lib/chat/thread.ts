/**
 * Phase 31.1 — chat thread helpers (server-only).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Viewer = 'lo' | 'borrower' | 'coborrower' | 'realtor' | 'title_agent';

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  content_type: string;
  document_id: string | null;
  document_name: string | null;
  visible_to: string[];
  created_at: string;
}

/** Get the loan's chat thread, creating it (with the LO + borrower) on first use. */
export async function getOrCreateThread(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string
): Promise<{ id: string; realtor_in_thread: boolean; realtor_portal_id: string | null; realtor_sees_borrower_messages: boolean } | null> {
  const { data: existing } = await sb
    .from('loan_chat_threads')
    .select('id, realtor_in_thread, realtor_portal_id, realtor_sees_borrower_messages')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (existing) return existing;

  const { data: lead } = await sb.from('leads').select('assigned_to').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return null;

  const { data: created } = await sb
    .from('loan_chat_threads')
    .insert({ lead_id: leadId, org_id: orgId, lo_id: lead.assigned_to ?? null, borrower_in_thread: true })
    .select('id, realtor_in_thread, realtor_portal_id, realtor_sees_borrower_messages')
    .single();
  return created ?? null;
}

/**
 * Visibility filter. A message is visible to a viewer when the viewer role is in
 * message.visible_to. Borrower and co-borrower see each other's "borrower"/
 * "coborrower"-targeted messages. Realtors additionally never see anything that
 * wasn't explicitly shared with them.
 */
export function messageVisibleTo(visible_to: string[], viewer: Viewer): boolean {
  if (viewer === 'lo') return true; // LO sees the full thread
  if (viewer === 'borrower' || viewer === 'coborrower') {
    return visible_to.includes('borrower') || visible_to.includes('coborrower');
  }
  return visible_to.includes(viewer);
}

export function filterMessages(messages: ChatMessage[], viewer: Viewer): ChatMessage[] {
  if (viewer === 'lo') return messages;
  return messages.filter((m) => messageVisibleTo(m.visible_to, viewer));
}
