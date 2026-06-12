'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { ExtensionTriggerBadge } from './ExtensionTriggerBadge';
import { RateLockExtensionModal } from './RateLockExtensionModal';

interface ExpiringAlert {
  id: string;
  lead_id: string;
  lock_expiry_date: string;
  extension_status: string;
  business_days_left: number;
  lead: { display_name: string; loan_amount: number | null; stage: string } | null;
}

export function ExpiringLocksWidget() {
  const [alerts, setAlerts] = useState<ExpiringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState<{ leadId: string; alertId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/rate-locks/expiring?days=5');
    const data = await res.json();
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Expiring Rate Locks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Locks within 5 business days — request an extension</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center">
          <IconLock size={26} className="text-[#C9A95C] mx-auto" />
          <p className="mt-3 text-sm font-medium text-gray-900">No locks expiring soon</p>
          <p className="mt-1 text-xs text-gray-500">Locks within 5 business days will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.lead?.display_name ?? 'Borrower'}</p>
                <p className="text-xs text-gray-400">
                  {a.lead?.loan_amount != null ? `$${Math.round(a.lead.loan_amount).toLocaleString()} · ` : ''}
                  {(a.lead?.stage ?? '').replace(/_/g, ' ')}
                </p>
              </div>
              <ExtensionTriggerBadge
                leadId={a.lead_id}
                alertId={a.id}
                businessDaysLeft={a.business_days_left}
                onWizardOpen={(leadId, alertId) => setWizard({ leadId, alertId })}
              />
            </div>
          ))}
        </div>
      )}

      {wizard && (
        <RateLockExtensionModal
          leadId={wizard.leadId}
          alertId={wizard.alertId}
          onClose={() => setWizard(null)}
          onComplete={load}
        />
      )}
    </div>
  );
}
