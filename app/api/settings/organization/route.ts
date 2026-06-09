import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/settings/organization — current org profile.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('organizations')
    .select('id, name, nmls_company_id, licensed_states, billing_email')
    .eq('id', orgId)
    .maybeSingle();

  return NextResponse.json({ organization: data });
}

// PUT /api/settings/organization — update company profile (admins only).
export async function PUT(req: NextRequest) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can edit organization settings.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(body.name);
  if (!name) return NextResponse.json({ error: 'Company name is required.' }, { status: 422 });

  // Licensed states — normalize to uppercase 2-letter codes.
  const states = Array.isArray(body.licensed_states)
    ? Array.from(
        new Set(
          (body.licensed_states as unknown[])
            .map((s) => str(s).toUpperCase())
            .filter((s) => /^[A-Z]{2}$/.test(s))
        )
      )
    : undefined;

  const update: Record<string, unknown> = {
    name,
    nmls_company_id: str(body.nmls_company_id) || null,
    billing_email: str(body.billing_email) || null,
    updated_at: new Date().toISOString(),
  };
  if (states) update.licensed_states = states;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('organizations')
    .update(update)
    .eq('id', orgId)
    .select('id, name, nmls_company_id, licensed_states, billing_email')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organization: data });
}
