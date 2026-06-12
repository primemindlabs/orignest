'use client';

import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';

export function ComplianceCheckBadge({ passed, flags }: { passed: boolean; flags: string[] }) {
  if (passed) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-xl border border-green-100">
        <IconCheck size={16} className="text-green-500 flex-shrink-0" />
        <p className="text-sm text-green-700 font-medium">Compliance check passed — ready to approve</p>
      </div>
    );
  }
  return (
    <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-100 space-y-2">
      <div className="flex items-center gap-2">
        <IconAlertTriangle size={16} className="text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700 font-medium">Compliance issues — edit before approving</p>
      </div>
      <ul className="space-y-1 pl-6">
        {flags.map((flag, i) => (
          <li key={i} className="text-xs text-red-600 list-disc">{flag}</li>
        ))}
      </ul>
    </div>
  );
}
