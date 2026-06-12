// Phase 105 — public submit (no auth; token-gated). Marks submitted, syncs the
// application into the CRM lead (real leads columns), and completes the session.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const sb = createAdminClient();

  const { data: app } = await sb.from('applications').select('*').eq('token', token).maybeSingle();
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (app.status !== 'submitted') {
    await sb
      .from('applications')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('token', token);
  }

  // ── CRM sync: map onto the REAL leads columns (first_name/last_name/phone/email;
  // stage 'new_inquiry' -> 'application'). Only overwrite empty lead fields. ──────
  const { data: lead } = await sb
    .from('leads')
    .select('id, stage, first_name, last_name, phone, email, loan_amount, loan_purpose, property_city, property_state, loan_type')
    .eq('id', app.lead_id)
    .eq('org_id', app.org_id)
    .maybeSingle();

  if (lead) {
    const pick = <T,>(incoming: T, existing: T) => (existing == null || existing === '' ? incoming : existing);
    await sb
      .from('leads')
      .update({
        first_name: pick(app.borrower_first_name, lead.first_name),
        last_name: pick(app.borrower_last_name, lead.last_name),
        phone: pick(app.borrower_phone, lead.phone),
        email: pick(app.borrower_email, lead.email),
        loan_amount: pick(app.desired_loan_amount, lead.loan_amount),
        loan_purpose: pick(app.loan_purpose, lead.loan_purpose),
        property_city: pick(app.property_city, lead.property_city),
        property_state: pick(app.property_state, lead.property_state),
        loan_type: pick(app.loan_type_preference, lead.loan_type),
        stage: lead.stage === 'new_inquiry' ? 'application' : lead.stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', app.lead_id)
      .eq('org_id', app.org_id);
  }

  // Best-effort: mark the abandon-recovery session complete.
  try {
    await sb
      .from('application_sessions')
      .update({ completed_at: new Date().toISOString(), completion_pct: 100 })
      .eq('lead_id', app.lead_id);
  } catch {
    /* optional */
  }

  return NextResponse.json({ ok: true });
}
