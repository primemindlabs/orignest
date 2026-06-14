'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import type { ComplianceIssue } from '@/lib/contentStudio/auditPostCompliance';

export function ComplianceWarning({ issues }: { issues: ComplianceIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className="mt-2 bg-[#FFFBF0] border border-[#C9A95C]/40 rounded-lg px-3 py-2">
      {issues.map((iss, i) => (
        <p key={i} className="text-xs text-[#8A6A1A] flex items-start gap-1.5">
          <IconAlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          {iss.description}
        </p>
      ))}
    </div>
  );
}
