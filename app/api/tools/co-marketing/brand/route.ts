// Phase 118 — LO brand profile (used to co-brand generated materials).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

const FIELDS = ['headshot_storage_path', 'company_logo_storage_path', 'brand_color', 'tagline', 'phone_display', 'website_url'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ brand: null });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ brand: null });
  const { data } = await sb.from('lo_brand_profiles').select('*').eq('org_id', orgId).eq('user_id', profile.id).maybeSingle();
  return NextResponse.json({ brand: data ?? { brand_color: '#C9A95C' } });
}

export async function PUT(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const patch: Record<string, unknown> = { org_id: orgId, user_id: profile.id, updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f] === '' ? null : body[f];

  const { data, error } = await sb.from('lo_brand_profiles').upsert(patch, { onConflict: 'org_id,user_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brand: data });
}
