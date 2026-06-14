/**
 * Phase 128 — pre-drafted message builders. Templates personalized with Ashley
 * Brain™ memories (Phase 127): if the LO has logged a "formal" communication
 * style for the entity, address them by full name; otherwise use first name.
 *
 * NOTE: the NMLS disclaimer is appended at EXECUTION time (lib/autopilot/executeAction),
 * not here — so the draft the LO previews stays clean and the disclaimer is
 * guaranteed on the actual send.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEntityMemories } from '@/lib/brain/getEntityMemories';
import type { AutopilotEntityType } from './types';

async function preferredName(
  sb: SupabaseClient,
  loId: string,
  entityType: AutopilotEntityType,
  entityId: string,
  firstName: string | null,
  fullName: string,
): Promise<string> {
  const first = (firstName ?? '').trim() || fullName;
  try {
    const mems = await getEntityMemories(sb, loId, entityType, entityId, {
      types: ['communication_style', 'preference'],
      limit: 3,
    });
    const blob = mems.map((m) => m.memory_text).join(' ').toLowerCase();
    if (/\b(formal|full name|last name|mr\.|mrs\.|ms\.|dr\.)\b/.test(blob)) return fullName;
  } catch {
    // Ashley Brain not provisioned / no memories — fall back to first name.
  }
  return first;
}

export async function draftConditionFollowup(
  sb: SupabaseClient,
  loId: string,
  borrowerId: string,
  firstName: string | null,
  fullName: string,
  conditionText: string,
): Promise<string> {
  const name = await preferredName(sb, loId, 'borrower', borrowerId, firstName, fullName);
  return `Hi ${name}, just following up on the ${conditionText.toLowerCase()} — we still need this to keep your loan moving forward. Let me know if you have any questions or hit a snag getting it over!`;
}

export async function draftRealtorCheckin(
  sb: SupabaseClient,
  loId: string,
  realtorId: string,
  firstName: string | null,
  fullName: string,
): Promise<string> {
  const name = await preferredName(sb, loId, 'realtor', realtorId, firstName, fullName);
  return `Hi ${name}, it's been a little while! Wanted to check in and see if you have any buyers I can help get pre-approved. Always happy to turn something around fast for you.`;
}

export function draftBirthday(firstName: string | null): string {
  const name = (firstName ?? '').trim();
  return `Happy birthday${name ? ` ${name}` : ''}! Wishing you a wonderful day. 🎉`;
}
