'use client';

import { useEffect, useState } from 'react';
import { useOrganizationList, useUser } from '@clerk/nextjs';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';

/** Ashley character — compact version for onboarding */
function AshleyCharacter({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ashley"
    >
      <ellipse cx="90" cy="188" rx="48" ry="8" fill="rgba(201,169,92,0.18)" />
      <rect x="54" y="120" width="72" height="62" rx="20" fill="#1e3a5f" />
      <path d="M78 140 L90 154 L102 140 C102 140 96 136 90 136 C84 136 78 140 78 140Z" fill="#C9A95C" />
      <ellipse cx="90" cy="96" rx="34" ry="38" fill="#F5E6CC" />
      <path d="M56 86 C56 60 68 50 90 50 C112 50 124 60 124 86" fill="#3D2B1F" />
      <ellipse cx="90" cy="54" rx="34" ry="12" fill="#3D2B1F" />
      <ellipse cx="56" cy="98" rx="7" ry="9" fill="#F0D9BB" />
      <ellipse cx="124" cy="98" rx="7" ry="9" fill="#F0D9BB" />
      <ellipse cx="77" cy="94" rx="8" ry="9" fill="white" />
      <ellipse cx="103" cy="94" rx="8" ry="9" fill="white" />
      <ellipse cx="78" cy="95" rx="5" ry="6" fill="#3D2B1F" />
      <ellipse cx="104" cy="95" rx="5" ry="6" fill="#3D2B1F" />
      <circle cx="79.5" cy="93.5" r="1.8" fill="white" />
      <circle cx="105.5" cy="93.5" r="1.8" fill="white" />
      <path d="M68 83 Q77 79 84 82" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M96 82 Q103 79 112 83" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M78 112 Q90 120 102 112" stroke="#C4906A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="67" cy="108" rx="8" ry="5" fill="#F4A0A0" fillOpacity="0.35" />
      <ellipse cx="113" cy="108" rx="8" ry="5" fill="#F4A0A0" fillOpacity="0.35" />
      <circle cx="118" cy="56" r="13" fill="#C9A95C" />
      <text x="118" y="61" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" fontFamily="system-ui">IQ</text>
    </svg>
  );
}

/** AshleyIQ wordmark */
function AshleyMark() {
  return (
    <div className="flex items-center gap-3">
      <AshleyCharacter size={48} />
      <div>
        <div className="flex items-baseline">
          <span className="text-[18px] font-bold text-gray-900">Ashley</span>
          <span className="text-[18px] font-bold text-[#C9A95C]">IQ</span>
        </div>
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

  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);

  const memberships = userMemberships?.data ?? [];

  // If the user already belongs to an organization, send them straight to the
  // dashboard. The dashboard resolves the org from membership server-side, so we
  // do NOT need to wait on setActive() (unreliable on a Clerk dev instance) or on
  // provisioning — getOrgContext() self-heals the Supabase rows. Firing setActive
  // best-effort just keeps the in-app org switcher in sync.
  useEffect(() => {
    if (!isLoaded) return;
    const first = memberships[0];
    if (first && !activating) {
      setActivating(true);
      try {
        setActive?.({ organization: first.organization.id });
      } catch {
        /* non-blocking */
      }
      window.location.assign('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, memberships.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!createOrganization) return;
    setBusy(true);
    try {
      const org = await createOrganization({ name: companyName.trim() });
      // Best-effort active-org sync for the in-app switcher; the dashboard
      // resolves + provisions from membership server-side, so don't block on it.
      try {
        await setActive?.({ organization: org.id });
      } catch {
        /* non-blocking */
      }
      window.location.assign('/dashboard');
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
        <Logo size={44} />
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
        <Logo size={44} />
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
