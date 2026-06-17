import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Smart-1003 (Phase 18) draft persistence. Structured, non-PII section data only —
// SSN/DOB are never written here (they use the encrypted columns via a separate flow).
const SECTION_KEYS = [
  'loan_data', 'property_data', 'borrower_data', 'employment_data', 'declarations_data',
] as const;

// Guard: never let raw SSN/DOB leak into the JSONB section blobs.
const FORBIDDEN_KEYS = /(ssn|social.?security|date.?of.?birth|\bdob\b)/i;
function stripForbidden(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    clean[k] = v;
  }
  return clean;
}

async function resolveLead(orgId: string, leadId: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data;
}

// GET — load the lead's draft application, creating one if none exists.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const lead = await resolveLead(orgId, params.id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const sb = createAdminClient();
  let { data: app } = await sb
    .from('loan_applications')
    .select(
      'id, status, current_section, loan_data, property_data, borrower_data, employment_data, declarations_data, updated_at'
    )
    .eq('lead_id', params.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    const { data: created, error } = await sb
      .from('loan_applications')
      .insert({ org_id: orgId, lead_id: params.id, application_type: 'residential' })
      .select(
        'id, status, current_section, loan_data, property_data, borrower_data, employment_data, declarations_data, updated_at'
      )
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    app = created;
  }

  return NextResponse.json({ application: app });
}

// PUT — save section data + progress. Body: { sections: {loan_data, ...}, status?, current_section? }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const lead = await resolveLead(orgId, params.id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  let body: {
    sections?: Record<string, Record<string, unknown>>;
    status?: string;
    current_section?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of SECTION_KEYS) {
    const section = body.sections?.[key];
    if (section && typeof section === 'object') {
      update[key] = stripForbidden(section as Record<string, unknown>);
    }
  }
  if (typeof body.current_section === 'number') update.current_section = body.current_section;
  if (body.status && ['draft', 'submitted'].includes(body.status)) {
    update.status = body.status;
    if (body.status === 'submitted') update.submitted_at = new Date().toISOString();
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('loan_applications')
    .update(update)
    .eq('lead_id', params.id)
    .eq('org_id', orgId)
    .select('id, status, current_section, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Propagate the canonical loan fields onto the leads row so the pipeline, PPE,
  // LTV and commission (which all read leads.*) reflect 1003 edits everywhere.
  // (appraised_value in the 1003 maps to the leads.estimated_value value column.)
  const ld = body.sections?.loan_data ?? {};
  const num = (v: unknown) => (v === '' || v == null ? undefined : Number(v));
  const str = (v: unknown) => (v === '' || v == null ? undefined : String(v));
  const leadSync: Record<string, unknown> = {};
  const la = num(ld.loan_amount); if (la !== undefined && Number.isFinite(la)) leadSync.loan_amount = la;
  const av = num(ld.appraised_value); if (av !== undefined && Number.isFinite(av)) leadSync.estimated_value = av;
  for (const [src, dst] of [['loan_type', 'loan_type'], ['loan_purpose', 'loan_purpose'], ['property_type', 'property_type'], ['occupancy_type', 'occupancy_type']] as const) {
    const v = str(ld[src]); if (v !== undefined) leadSync[dst] = v;
  }
  if (Object.keys(leadSync).length) {
    await sb.from('leads').update(leadSync).eq('id', params.id).eq('org_id', orgId);
  }

  return NextResponse.json({ application: data });
}
