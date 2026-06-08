import { auth, clerkClient } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type OrgContext = {
  userId: string | null;
  /** Clerk organization id (org_...) */
  clerkOrgId: string | null;
  /** Supabase organizations.id (uuid) — this is what every `org_id` column expects */
  orgId: string | null;
  role: string;
};

/**
 * The single, reliable way to get the current user's org context in server code.
 *
 * Why this exists instead of a raw `auth()`:
 *  - `auth().orgId` (the Clerk active-org session claim) is unreliable on a Clerk
 *    development instance served from a custom domain — the dev-browser handshake
 *    often drops it, so the claim is null even for a user who owns an org. We fall
 *    back to the user's membership via the Clerk Backend API, which is reliable.
 *  - Every `org_id` column in Supabase is a uuid (organizations.id), NOT the Clerk
 *    org string. Callers must filter by the uuid. This resolves it once.
 *  - The Supabase organizations/profile rows may not exist yet (provision can lag),
 *    so we self-heal by upserting them.
 *
 * Reads should use the admin client with an explicit `.eq('org_id', orgId)` filter:
 * the app authenticates with Clerk, not Supabase, so RLS (which keys off a Clerk
 * JWT claim that the anon client never sends) would otherwise return zero rows.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const { userId, orgId: sessionOrgId } = await auth();
  if (!userId) return { userId: null, clerkOrgId: null, orgId: null, role: 'loan_officer' };

  const sb = createAdminClient();

  // ── Fast, reliable path ─────────────────────────────────────────────────────
  // If the user's Supabase profile already links to an org, use it. profile.org_id
  // IS the uuid every query needs, and this is a plain DB read — it does NOT depend
  // on the Clerk active-org session claim (unreliable on a dev instance) or on a
  // Clerk Backend API call from the serverless runtime (which can time out/fail).
  const { data: existingProfile } = await sb
    .from('profiles')
    .select('org_id, role')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (existingProfile?.org_id) {
    return {
      userId,
      clerkOrgId: sessionOrgId ?? null,
      orgId: existingProfile.org_id as string,
      role: (existingProfile.role as string) ?? 'loan_officer',
    };
  }

  // ── Self-heal path (new user / no profile link yet) ─────────────────────────
  let clerkOrgId: string | null = sessionOrgId ?? null;
  let role = 'loan_officer';

  if (!clerkOrgId) {
    try {
      const clerk = await clerkClient();
      const memberships = await clerk.users.getOrganizationMembershipList({ userId, limit: 1 });
      const m = memberships.data[0];
      clerkOrgId = m?.organization.id ?? null;
      if (m?.role === 'org:admin' || m?.role === 'admin') role = 'admin';
    } catch {
      // No org / Clerk lookup failed.
    }
  }

  if (!clerkOrgId) return { userId, clerkOrgId: null, orgId: null, role };

  // Resolve (or self-heal) the Supabase organization row for this Clerk org.
  let { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .maybeSingle();

  if (!org) {
    let name = 'My Company';
    try {
      const clerk = await clerkClient();
      const o = await clerk.organizations.getOrganization({ organizationId: clerkOrgId });
      name = o.name || name;
    } catch {
      // Fall back to the default name.
    }
    const { data: created } = await sb
      .from('organizations')
      .upsert({ clerk_org_id: clerkOrgId, name }, { onConflict: 'clerk_org_id' })
      .select('id')
      .maybeSingle();
    org = created ?? null;
  }

  const orgId = org?.id ?? null;

  // Self-heal the caller's profile row + its org link so role/name lookups work.
  if (orgId) {
    const { data: profile } = await sb
      .from('profiles')
      .select('role, org_id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!profile || profile.org_id !== orgId) {
      let email = '';
      let firstName = '';
      let lastName = '';
      try {
        const clerk = await clerkClient();
        const u = await clerk.users.getUser(userId);
        email =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
          u.emailAddresses[0]?.emailAddress ??
          '';
        firstName = u.firstName ?? '';
        lastName = u.lastName ?? '';
      } catch {
        // best-effort
      }
      await sb
        .from('profiles')
        .upsert(
          {
            clerk_user_id: userId,
            org_id: orgId,
            email,
            first_name: firstName,
            last_name: lastName,
            role: profile?.role ?? role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'clerk_user_id' }
        )
        .then(() => undefined, () => undefined);
    } else if (profile?.role) {
      role = profile.role;
    }
  }

  return { userId, clerkOrgId, orgId, role };
}
