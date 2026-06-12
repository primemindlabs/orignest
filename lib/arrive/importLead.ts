/**
 * Phase 94 — Arrive (arrive.app) relocation-concierge lead import.
 *
 * Adapted to the real stack: there is NO `loans` table and borrowers are not
 * auth.users — a "loan stub" is a row in `leads`, with the borrower's identity
 * on that row. Routing is per-LO, so the caller resolves org_id + the assigned
 * LO (profiles.id) from the integration config and passes them in.
 *
 * TCPA: Arrive collects its own consent, but it does NOT transfer to our records.
 * First contact is EMAIL ONLY; SMS stays off (sms_consent defaults false) until
 * the borrower acknowledges TCPA in the portal.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { getResend, FROM_EMAIL } from '@/lib/resend';
import { buildArriveWelcomeEmail } from '@/lib/arrive/welcomeEmail';

export interface ArriveLead {
  leadId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  originCity?: string;
  destinationCity?: string;
  targetMoveDate?: string; // ISO date (YYYY-MM-DD)
  estimatedBudget?: number;
  preApprovedElsewhere?: boolean;
}

export interface ArriveIntegration {
  lo_id: string; // profiles.id — the assigned LO
  org_id: string; // organizations.id — the tenant
}

type Admin = ReturnType<typeof createAdminClient>;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

function isoDate(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/** Match an existing borrower by email within the tenant, else create the loan stub. */
async function matchOrCreateLead(sb: Admin, payload: ArriveLead, integ: ArriveIntegration): Promise<string | null> {
  const email = payload.email?.toLowerCase().trim() || null;
  const now = new Date().toISOString();

  if (email) {
    const { data: existing } = await sb
      .from('leads')
      .select('id, arrive_lead_id')
      .eq('org_id', integ.org_id)
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      // Link the existing lead to this Arrive referral — never clobber stage/owner.
      await sb
        .from('leads')
        .update({
          arrive_lead_id: existing.arrive_lead_id ?? payload.leadId,
          arrive_imported_at: now,
          lead_source: 'arrive',
          updated_at: now,
        })
        .eq('id', existing.id);
      return existing.id;
    }
  }

  const { data: created, error } = await sb
    .from('leads')
    .insert({
      org_id: integ.org_id,
      assigned_to: integ.lo_id,
      first_name: payload.firstName ?? '',
      last_name: payload.lastName ?? '',
      email: payload.email,
      phone: payload.phone ?? null,
      stage: 'pre_qual',
      loan_type: 'conventional',
      loan_purpose: 'purchase',
      property_city: payload.destinationCity ?? null, // buying in the destination market
      estimated_value: num(payload.estimatedBudget),
      lead_source: 'arrive',
      arrive_lead_id: payload.leadId,
      arrive_imported_at: now,
      sms_consent: false, // TCPA not transferred from Arrive
    })
    .select('id')
    .single();

  if (error) {
    console.error('[arrive] lead insert failed', error);
    return null;
  }
  return created?.id ?? null;
}

/** Best-effort welcome email (EMAIL ONLY — see TCPA note above). */
async function sendWelcomeEmail(sb: Admin, payload: ArriveLead, integ: ArriveIntegration): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY || !payload.email) return;
    const { data: lo } = await sb
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', integ.lo_id)
      .maybeSingle();
    const loName = `${lo?.first_name ?? ''} ${lo?.last_name ?? ''}`.trim() || 'Your mortgage advisor';
    const portalUrl = `${APP_URL}/apply`;
    const resend = getResend();
    await resend.emails.send({
      from: `${loName} <${FROM_EMAIL}>`,
      to: payload.email,
      subject: `Welcome! I'm your mortgage advisor${payload.destinationCity ? ` for your move to ${payload.destinationCity}` : ''}`,
      html: buildArriveWelcomeEmail(payload, { name: loName, email: lo?.email ?? null }, portalUrl),
    });
  } catch (e) {
    console.error('[arrive] welcome email failed', e); // best-effort, never blocks the import
  }
}

/**
 * Import one Arrive lead: create/match the loan stub, write the import log, and
 * send the welcome email. Idempotency is enforced by arrive_lead_imports'
 * UNIQUE(arrive_lead_id); callers should dedup before calling, but a duplicate
 * insert here simply fails harmlessly.
 */
export async function importArriveLead(payload: ArriveLead, integ: ArriveIntegration): Promise<void> {
  const sb = createAdminClient();
  try {
    const leadId = await matchOrCreateLead(sb, payload, integ);

    const { error: logErr } = await sb.from('arrive_lead_imports').insert({
      org_id: integ.org_id,
      lo_id: integ.lo_id,
      arrive_lead_id: payload.leadId,
      lead_id: leadId,
      arrive_payload: payload,
      first_name: payload.firstName ?? null,
      last_name: payload.lastName ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      origin_city: payload.originCity ?? null,
      destination_city: payload.destinationCity ?? null,
      target_move_date: isoDate(payload.targetMoveDate),
      estimated_budget: num(payload.estimatedBudget),
      pre_approved_elsewhere: payload.preApprovedElsewhere ?? false,
      import_status: leadId ? 'imported' : 'error',
      error_message: leadId ? null : 'Lead create/match failed',
    });
    if (logErr) console.error('[arrive] import log insert failed', logErr);

    if (leadId) await sendWelcomeEmail(sb, payload, integ);
  } catch (e) {
    console.error('[arrive] import failed', e);
    // Record the failure (ignore UNIQUE collisions on retry).
    await sb
      .from('arrive_lead_imports')
      .insert({
        org_id: integ.org_id,
        lo_id: integ.lo_id,
        arrive_lead_id: payload.leadId,
        arrive_payload: payload,
        email: payload.email ?? null,
        import_status: 'error',
        error_message: String(e),
      })
      .then(
        () => {},
        () => {},
      );
  }
}
