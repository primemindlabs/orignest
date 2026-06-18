// POST /api/onboarding/create-org — create a workspace WITHOUT depending on Clerk
// Organizations (which are off-plan). Inserts a Supabase organizations row + links
// the user's profile with their chosen role. getOrgContext resolves everything from
// profiles.org_id thereafter, so a synthetic clerk_org_id is harmless.
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'branch_manager', 'loan_officer', 'loa', 'processor'];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { name?: string; role?: string };
  const name = (b.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  const role = ROLES.includes(b.role ?? '') ? (b.role as string) : 'admin';

  const sb = createAdminClient();

  // Already has an org? Just return it (idempotent).
  const { data: existing } = await sb.from('profiles').select('org_id').eq('clerk_user_id', userId).maybeSingle();
  if (existing?.org_id) return NextResponse.json({ ok: true, orgId: existing.org_id });

  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .insert({ name, clerk_org_id: `local_${randomUUID()}` })
    .select('id')
    .single();
  if (orgErr || !org) return NextResponse.json({ error: orgErr?.message ?? 'Could not create workspace' }, { status: 500 });

  let email = '', firstName = '', lastName = '';
  try {
    const u = await (await clerkClient()).users.getUser(userId);
    email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? '';
    firstName = u.firstName ?? '';
    lastName = u.lastName ?? '';
  } catch { /* best-effort */ }

  await sb.from('profiles').upsert(
    { clerk_user_id: userId, org_id: org.id, role, email, first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() },
    { onConflict: 'clerk_user_id' },
  );

  return NextResponse.json({ ok: true, orgId: org.id });
}
