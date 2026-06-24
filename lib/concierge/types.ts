/**
 * Phase 144 — Ashley Concierge shared types. SERVER-ONLY use.
 */
import 'server-only';

export type AutonomyMode = 'off' | 'suggest' | 'autonomous';

export interface ConciergeSettings {
  enabled: boolean;
  autonomy_default: AutonomyMode;
  allow_autonomous: boolean;
  speed_to_lead: boolean;
  persona_tone: string;
  persona_specialties: string | null;
  products: string | null;
  business_goal: string;
  booking_url: string | null;
  application_url: string | null;
  max_ai_replies: number;
  custom_instructions: string | null;
}

export const DEFAULT_SETTINGS: ConciergeSettings = {
  enabled: false,
  autonomy_default: 'suggest',
  allow_autonomous: false,
  speed_to_lead: false,
  persona_tone: 'warm, concise, and professional',
  persona_specialties: null,
  products: null,
  business_goal: 'qualify the borrower and book a call or start an application',
  booking_url: null,
  application_url: null,
  max_ai_replies: 6,
  custom_instructions: null,
};

export interface ConciergeContext {
  orgId: string;
  leadId: string;
  loId: string | null;
  borrowerFirstName: string;
  loName: string;
  companyName: string;
  settings: ConciergeSettings;
  memories: string[];          // Ashley Brain facts about this borrower
  knownFacts: Record<string, unknown>; // lead fields already captured
}

export interface ToolTrace {
  name: string;
  input: unknown;
  result: unknown;
}

export interface ConciergeResult {
  /** false = concierge did not act (off / escalated / opted out) — caller keeps default behavior. */
  handled: boolean;
  mode: AutonomyMode;
  reply: string | null;        // the assistant's text reply (sent or drafted)
  sent: boolean;               // true only when actually transmitted
  escalated: boolean;
  escalationReason?: string;
  reason?: string;             // why not sent / not handled
  toolTrace: ToolTrace[];
}
