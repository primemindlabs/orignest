import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Provision Supabase rows for an organization the user just created or joined.
 * Idempotent: upserts the organization + the caller's profile and links them.
 * Used by the (Stripe-free) onboarding flow.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clerkOrgId: string | undefined = body?.clerkOrgId;
  const companyName: string = (body?.companyName as string)?.trim() || 'My Company';
  if (!clerkOrgId) {
    return NextResponse.json({ error: 'clerkOrgId required' }, { status: 400 });
  }

  // Verify the caller actually belongs to this organization.
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({ userId });
  const membership = memberships.data.find((m) => m.organization.id === clerkOrgId);
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
  }

  const sb = createAdminClient();

  // Upsert organization, then read its id.
  await sb
    .from('organizations')
    .upsert(
      {
        clerk_org_id: clerkOrgId,
        name: companyName,
        subscription_status: 'trialing',
        subscription_plan: 'growth',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_org_id', ignoreDuplicates: false }
    )
    .then(() => undefined)
    .catch(() => undefined);

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .maybeSingle();

  // Pull the caller's details from Clerk for the profile row.
  const user = await clerk.users.getUser(userId);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    '';

  await sb
    .from('profiles')
    .upsert(
      {
        clerk_user_id: userId,
        org_id: org?.id ?? null,
        email,
        first_name: user.firstName ?? '',
        last_name: user.lastName ?? '',
        role: membership.role === 'org:admin' ? 'admin' : 'loan_officer',
        avatar_url: user.imageUrl,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id', ignoreDuplicates: false }
    )
    .then(() => undefined)
    .catch(() => undefined);

  return NextResponse.json({ ok: true, orgId: org?.id ?? null });
}
