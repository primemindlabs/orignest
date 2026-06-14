/**
 * Phase 127 — Ashley Brain™ shared types.
 * Isomorphic (no server-only imports) so UI + server can both import.
 */

export const BRAIN_ENTITY_TYPES = ['borrower', 'realtor', 'lender_ae', 'referral_partner'] as const;
export type BrainEntityType = (typeof BRAIN_ENTITY_TYPES)[number];

export const BRAIN_MEMORY_TYPES = [
  'relationship_fact',
  'preference',
  'goal',
  'objection',
  'lender_preference',
  'life_event',
  'communication_style',
  'referral_intel',
] as const;
export type BrainMemoryType = (typeof BRAIN_MEMORY_TYPES)[number];

export const BRAIN_MEMORY_SOURCES = [
  'call_note',
  'meeting_note',
  'portal_chat',
  'sms',
  'email',
  'lo_input',
  'autopilot_outcome',
] as const;
export type BrainMemorySource = (typeof BRAIN_MEMORY_SOURCES)[number];

export const BRAIN_LOG_TYPES = [
  'call_note',
  'meeting_note',
  'portal_chat',
  'sms_sent',
  'sms_received',
  'email_sent',
  'email_received',
  'lo_note',
  'autopilot_outcome',
] as const;
export type BrainLogType = (typeof BRAIN_LOG_TYPES)[number];

export interface BrainMemory {
  id: string;
  memory_type: BrainMemoryType;
  memory_text: string;
  source: BrainMemorySource;
  extracted_at: string;
  is_active: boolean;
}

export interface BrainLog {
  id: string;
  org_id: string;
  lo_id: string;
  entity_type: BrainEntityType | null;
  entity_id: string | null;
  log_type: BrainLogType;
  content: string;
  raw_metadata: Record<string, unknown>;
}

export interface BrainSearchResult {
  content_id: string;
  content_type: string;
  entity_type: string | null;
  entity_id: string | null;
  content_text: string;
  similarity: number; // 0..1; for the text-search fallback this is a coarse score
}

/** A memory extracted from a log by Claude (before it has an id). */
export interface ExtractedMemory {
  memory_type: BrainMemoryType;
  memory_text: string;
}

/** Display labels, used by the panel + summary block. */
export const MEMORY_TYPE_LABELS: Record<BrainMemoryType, string> = {
  relationship_fact: 'About Them',
  preference: 'Preferences',
  goal: 'Goals',
  objection: 'Concerns',
  lender_preference: 'Lender Notes',
  life_event: 'Life Events',
  communication_style: 'How to Reach',
  referral_intel: 'Partner Intel',
};

export const MEMORY_SOURCE_LABELS: Record<string, string> = {
  call_note: 'Call',
  meeting_note: 'Meeting',
  sms: 'Text',
  email: 'Email',
  portal_chat: 'Portal',
  lo_input: 'You',
  autopilot_outcome: 'Autopilot',
};
