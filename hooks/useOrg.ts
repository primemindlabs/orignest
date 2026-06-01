'use client';

import { useOrganization, useUser } from '@clerk/nextjs';

export interface ConduitOrg {
  orgId: string | undefined;
  orgName: string | undefined;
  orgSlug: string | undefined;
  userId: string | undefined;
  isLoaded: boolean;
}

/**
 * Convenience hook combining Clerk org + user into a single object.
 */
export function useConduitOrg(): ConduitOrg {
  const { organization, isLoaded } = useOrganization();
  const { user } = useUser();

  return {
    orgId: organization?.id,
    orgName: organization?.name,
    orgSlug: organization?.slug ?? undefined,
    userId: user?.id,
    isLoaded,
  };
}
