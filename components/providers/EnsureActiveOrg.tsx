'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useOrganizationList } from '@clerk/nextjs';

/**
 * Clerk does not auto-activate an organization on sign-in, so `auth().orgId` is
 * null until something calls `setActive`. The dashboard (and every page that
 * reads `auth().orgId`) needs an active org. Without this, a signed-in member
 * lands on /dashboard with no active org, the layout bounces them to
 * /onboarding, onboarding re-activates and soft-navigates back, and the page
 * "blinks" in an endless redirect loop.
 *
 * This mounts in the dashboard layout and, exactly once per session, sets the
 * user's first membership as the active org and does a single hard reload so the
 * refreshed session cookie (now carrying the org claim) reaches the server on
 * the next request. A sessionStorage guard guarantees it can never loop.
 */
export function EnsureActiveOrg() {
  const { isLoaded: authLoaded, orgId } = useAuth();
  const { isLoaded: listLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const ran = useRef(false);

  useEffect(() => {
    if (!authLoaded || !listLoaded || !setActive) return;

    // Active org already present — clear the one-shot guard for next time.
    if (orgId) {
      try {
        sessionStorage.removeItem('ensure-active-org');
      } catch {
        /* sessionStorage unavailable — ignore */
      }
      return;
    }

    const first = userMemberships?.data?.[0];
    if (!first) return; // no orgs — onboarding owns this case
    if (ran.current) return;

    try {
      if (sessionStorage.getItem('ensure-active-org') === '1') return; // already tried this session
      sessionStorage.setItem('ensure-active-org', '1');
    } catch {
      /* sessionStorage unavailable — proceed without the cross-reload guard */
    }

    ran.current = true;
    setActive({ organization: first.organization.id })
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        ran.current = false;
        try {
          sessionStorage.removeItem('ensure-active-org');
        } catch {
          /* ignore */
        }
      });
  }, [authLoaded, listLoaded, orgId, setActive, userMemberships?.data?.length]);

  return null;
}
