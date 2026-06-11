import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NMLS_REGEX = /^\d{6,7}$/;

// GET /api/settings/profile — the signed-in LO's profile + company name.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id, phone, title, email, avatar_url, comp_rate, monthly_volume_goal, role')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  return NextResponse.json({ profile, company: org?.name ?? null });
}

// PUT /api/settings/profile — update the signed-in LO's own profile.
export async function PUT(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(str(v));
    return Number.isFinite(n) ? n : null;
  };

  // NMLS — required for compliance docs; block save if present but malformed.
  const nmls = str(body.nmls_id);
  if (nmls && !NMLS_REGEX.test(nmls)) {
    return NextResponse.json({ error: 'NMLS # must be 6–7 digits.', field: 'nmls_id' }, { status: 422 });
  }

  const compRate = num(body.comp_rate);
  if (compRate != null && (compRate < 0 || compRate > 100)) {
    return NextResponse.json({ error: 'Commission rate must be between 0 and 100%.', field: 'comp_rate' }, { status: 422 });
  }
  const goal = num(body.monthly_volume_goal);
  if (goal != null && goal < 0) {
    return NextResponse.json({ error: 'Monthly volume goal cannot be negative.', field: 'monthly_volume_goal' }, { status: 422 });
  }

  // Only touch fields actually present in the request — the Compensation page
  // sends just comp_rate and must not wipe nmls/phone/title.
  const update: Record<string, unknown> = {};
  if ('nmls_id' in body) update.nmls_id = nmls || null;
  if ('phone' in body) update.phone = str(body.phone) || null;
  if ('title' in body) update.title = str(body.title) || null;
  // first_name/last_name are NOT NULL — only overwrite when a value is provided.
  if ('first_name' in body && str(body.first_name)) update.first_name = str(body.first_name);
  if ('last_name' in body && str(body.last_name)) update.last_name = str(body.last_name);
  if (compRate != null) update.comp_rate = compRate;
  if (goal != null) update.monthly_volume_goal = Math.round(goal);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('profiles')
    .update(update)
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
    .select('first_name, last_name, nmls_id, phone, title, comp_rate, monthly_volume_goal')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Goal ring + commission figures read these — refresh the dashboard immediately.
  revalidatePath('/dashboard');
  revalidatePath('/settings/profile');
  revalidatePath('/pipeline');

  return NextResponse.json({ profile: data });
}
