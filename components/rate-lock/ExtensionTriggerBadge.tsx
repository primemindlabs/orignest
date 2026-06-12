'use client';

import { IconLock } from '@tabler/icons-react';

interface Props {
  leadId: string;
  alertId: string;
  businessDaysLeft: number;
  onWizardOpen: (leadId: string, alertId: string) => void;
}

export function ExtensionTriggerBadge({ leadId, alertId, businessDaysLeft, onWizardOpen }: Props) {
  if (businessDaysLeft > 5) return null;
  const urgent = businessDaysLeft <= 2;
  const cls = urgent
    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
  const label =
    businessDaysLeft <= 0 ? 'Lock expired' : `Lock expires in ${businessDaysLeft}d`;

  return (
    <button
      onClick={() => onWizardOpen(leadId, alertId)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${cls}`}
    >
      <IconLock size={13} />
      {label} · Request extension
    </button>
  );
}
