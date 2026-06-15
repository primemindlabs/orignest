/**
 * Phase 137 — PUBLIC start of a branded full Smart-1003 application (no auth).
 * Resolves {brokerage}/{mlo} slugs → creates a lead in the LO's pipeline and a
 * draft loan_application, then returns the application_token. The borrower is then
 * routed to /apply/smart/[token] for the adaptive 1003 itself.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as {
    org_slug?: string;
    mlo_slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    loan_purpose?: string;
    sms_consent?: boolean;
  };

  if (!b.org_slug || !b.name || (!b.email && !b.phone)) {
    return NextResponse.json({ error: 'Name and a phone or email are required.' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { data: org } = await sb.from('organizations').select('id').eq('slug', b.org_slug).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Unknown application link.' }, { status: 404 });

  // The MLO is optional — the link may be brokerage-level. Scope to this org.
  let loId: string | null = null;
  if (b.mlo_slug) {
    const { data: lo } = await sb
      .from('profiles')
      .select('id')
      .eq('org_id', org.id)
      .eq('application_slug', b.mlo_slug)
      .maybeSingle();
    loId = lo?.id ?? null;
  }

  const [first, ...rest] = b.name.trim().split(' ');
  const { data: lead, error: leadErr } = await sb
    .from('leads')
    .insert({
      org_id: org.id,
      assigned_to: loId,
      first_name: first,
      last_name: rest.join(' ') || '',
      email: b.email ?? null,
      phone: b.phone ?? null,
      loan_purpose: b.loan_purpose ?? null,
      lead_source: 'application_link',
      stage: 'new_inquiry',
      sms_consent: !!b.sms_consent,
    })
    .select('id')
    .single();

  if (leadErr || !lead) return NextResponse.json({ error: 'Could not start application.' }, { status: 500 });

  const { data: app, error: appErr } = await sb
    .from('loan_applications')
    .insert({
      org_id: org.id,
      lead_id: lead.id,
      application_type: 'residential',
      submitted_via: 'public_link',
      loan_data: b.loan_purpose ? { loan_purpose: b.loan_purpose } : {},
    })
    .select('application_token')
    .single();

  if (appErr || !app?.application_token) {
    return NextResponse.json({ error: 'Could not start application.' }, { status: 500 });
  }

  return NextResponse.json({ token: app.application_token });
}
