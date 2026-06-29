/**
 * Facebook / Instagram Lead Ads — immediate lead import. SERVER-ONLY.
 *
 * Called straight from the leadgen webhook (no polling, no queue): retrieves the
 * lead's field data from the Graph API using the Page access token, maps it, and
 * creates/matches the loan stub right away. Mirrors the Arrive importer (P94).
 *
 * TCPA: the FB form's consent does NOT transfer to our records — first contact is
 * EMAIL ONLY; sms_consent stays false until acknowledged in the portal.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const GRAPH = `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? 'v21.0'}`;

export interface FbLeadConnection {
  connectionId: string;
  org_id: string;
  lo_id: string | null;
  page_id: string;
  pageToken: string;
}
export interface FbLeadValue { leadgen_id: string; form_id?: string; page_id?: string; created_time?: number }

type Admin = ReturnType<typeof createAdminClient>;
interface GraphLead { id: string; created_time?: string; form_id?: string; field_data?: { name: string; values: string[] }[] }

function pick(fd: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) { const v = fd[k]; if (v && v.trim()) return v.trim(); }
  return null;
}

/** Retrieve + import one lead. Returns the outcome; never throws. */
export async function importFacebookLead(value: FbLeadValue, conn: FbLeadConnection): Promise<{ status: 'imported' | 'duplicate' | 'error'; leadId: string | null }> {
  const sb = createAdminClient();

  // Dedup — UNIQUE(leadgen_id) is the DB backstop; a repeat delivery is a no-op.
  const { data: existing } = await sb.from('facebook_lead_imports').select('id').eq('leadgen_id', value.leadgen_id).maybeSingle();
  if (existing) return { status: 'duplicate', leadId: null };

  // Immediate retrieval of the actual field values from the Graph API.
  let graph: GraphLead | null = null;
  let fetchError: string | null = null;
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(value.leadgen_id)}?fields=id,created_time,form_id,field_data&access_token=${encodeURIComponent(conn.pageToken)}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) fetchError = (json as any)?.error?.message ?? `Graph API error ${res.status}`;
    else graph = json as GraphLead;
  } catch (e) {
    fetchError = (e as Error).message;
  }

  const fd: Record<string, string> = {};
  for (const f of graph?.field_data ?? []) if (f?.name) fd[f.name.toLowerCase()] = (f.values ?? [])[0] ?? '';

  const email = pick(fd, 'email')?.toLowerCase() ?? null;
  const phone = pick(fd, 'phone_number', 'phone', 'work_phone_number');
  let firstName = pick(fd, 'first_name');
  let lastName = pick(fd, 'last_name');
  const full = pick(fd, 'full_name', 'name');
  if (!firstName && full) { const parts = full.split(/\s+/); firstName = parts[0]; lastName = lastName ?? (parts.slice(1).join(' ') || null); }

  // leads.email is NOT NULL — require it to create the stub (FB forms collect it by default).
  const leadId = !fetchError && email ? await matchOrCreateLead(sb, conn, { email, phone, firstName, lastName }) : null;
  const status: 'imported' | 'error' = leadId ? 'imported' : 'error';
  const errorMessage = fetchError ?? (email ? null : 'No email in lead');

  await sb.from('facebook_lead_imports').insert({
    org_id: conn.org_id, lo_id: conn.lo_id, leadgen_id: value.leadgen_id,
    page_id: value.page_id ?? conn.page_id, form_id: value.form_id ?? graph?.form_id ?? null,
    lead_id: leadId, raw_payload: graph ?? { error: fetchError },
    first_name: firstName, last_name: lastName, email, phone,
    import_status: status, error_message: errorMessage,
  }).then(() => {}, () => {});

  const now = new Date().toISOString();
  await sb.from('facebook_lead_connections').update(
    status === 'imported' ? { last_lead_at: now, last_error: null, updated_at: now } : { last_error: errorMessage ?? 'import failed', updated_at: now },
  ).eq('id', conn.connectionId);

  return { status, leadId };
}

async function matchOrCreateLead(sb: Admin, conn: FbLeadConnection, p: { email: string; phone: string | null; firstName: string | null; lastName: string | null }): Promise<string | null> {
  const now = new Date().toISOString();

  const { data: existing } = await sb.from('leads').select('id').eq('org_id', conn.org_id).ilike('email', p.email).limit(1).maybeSingle();
  if (existing?.id) {
    await sb.from('leads').update({ lead_source: 'facebook', updated_at: now }).eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb.from('leads').insert({
    org_id: conn.org_id,
    assigned_to: conn.lo_id,
    first_name: p.firstName ?? '',
    last_name: p.lastName ?? '',
    email: p.email,
    phone: p.phone,
    stage: 'pre_qual',
    loan_type: 'conventional',
    loan_purpose: 'purchase',
    lead_source: 'facebook',
    sms_consent: false, // TCPA not transferred from the FB form
  }).select('id').single();

  if (error) { console.error('[facebook] lead insert failed', error); return null; }
  return created?.id ?? null;
}
