'use client';

import { useEffect, useState } from 'react';
import { useOrganizationList, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/** Small inline Ashley AI wordmark (matches the landing page). */
function AshleyMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path
            d="M11 3L13.5 8.5H19L14.5 12L16.5 17.5L11 14L5.5 17.5L7.5 12L3 8.5H8.5L11 3Z"
            fill="white"
            stroke="white"
            strokeWidth="0.5"
          />
          <circle cx="17" cy="5" r="2.5" fill="#2563EB" />
        </svg>
      </div>
      <div>
        <span className="text-[18px] font-bold text-gray-900">Ashley</span>
        <span className="text-[18px] font-bold text-blue-600"> AI</span>
        <p className="text-[11px] text-gray-400 leading-none">Your AI Mortgage Assistant</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useUser();
  const { isLoaded, setActive, userMemberships, createOrganization } = useOrganizationList({
    userMemberships: true,
  });
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);

  const memberships = userMemberships?.data ?? [];

  // If the user already belongs to an organization, activate it and go to the dashboard.
  useEffect(() => {
    if (!isLoaded || !setActive) return;
    const first = memberships[0];
    if (first && !activating) {
      setActivating(true);
      setActive({ organization: first.organization.id })
        .then(() =>
          fetch('/api/onboarding/provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clerkOrgId: first.organization.id,
              companyName: first.organization.name,
            }),
          }).catch(() => undefined)
        )
        .then(() => router.replace('/dashboard'))
        .catch(() => {
          setActivating(false);
          toast.error('Could not open your workspace. Please try again.');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, memberships.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!createOrganization || !setActive) return;
    setBusy(true);
    try {
      const org = await createOrganization({ name: companyName.trim() });
      await setActive({ organization: org.id });
      await fetch('/api/onboarding/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkOrgId: org.id, companyName: companyName.trim() }),
      }).catch(() => undefined);
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create your workspace';
      toast.error(msg);
      setBusy(false);
    }
  }

  // While we detect/activate an existing org, show a spinner instead of the form.
  if (!isLoaded || activating || memberships.length > 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <AshleyMark />
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Opening your workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <AshleyMark />
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
          Create your workspace
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Set up your mortgage company to get started with Ashley.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-1.5">
              Company name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Mortgage, LLC"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Continue to dashboard
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">
          Signed in as {user?.primaryEmailAddress?.emailAddress}
        </p>
      </div>
    </div>
  );
}
