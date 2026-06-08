'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ExternalLink } from 'lucide-react';
import type { SubscriptionStatus } from '@/types';

interface BillingActionsProps {
  hasStripeCustomer: boolean;
  status: SubscriptionStatus;
}

export function BillingActions({ hasStripeCustomer, status }: BillingActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleManageBilling() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to open billing portal');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!hasStripeCustomer) {
    return (
      <a
        href="/onboarding"
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors"
      >
        Choose a Plan
      </a>
    );
  }

  return (
    <button
      onClick={handleManageBilling}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <ExternalLink size={14} />
          Manage Billing
        </>
      )}
    </button>
  );
}
