/**
 * Phase 79 — save a dialed number that isn't in the CRM yet. After a call to an
 * unrecognized number ends, the MLO can save it as a lead (borrower) or a
 * partner (realtor). The call is already logged; this just creates the contact.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || 'Unknown', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function digits(p: string): string {
  return p.replace(/\D/g, '');
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { type?: 'lead' | 'partner'; name?: string; phone?: string };
  const { type, name, phone } = body;
  if (!type || !name || !phone) return NextResponse.json({ error: 'type, name and phone are required' }, { status: 400 });

  const sb = createAdminClient();

  if (type === 'partner') {
    const { first, last } = splitName(name);
    const { data, error } = await sb
      .from('realtors')
      .insert({ org_id: orgId, first_name: first, last_name: last || first, phone })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    return NextResponse.json({ id: data.id, type });
  }

  // Lead — leads.email is NOT NULL, so synthesize a placeholder the LO can replace.
  const { first, last } = splitName(name);
  const placeholderEmail = `noemail+${digits(phone) || 'unknown'}@placeholder.ashleyiq.com`;
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).eq('org_id', orgId).maybeSingle();

  const { data, error } = await sb
    .from('leads')
    .insert({
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: placeholderEmail,
      phone,
      stage: 'new_inquiry',
      lead_source: 'dialer',
      assigned_to: profile?.id ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ id: data.id, type });
}
