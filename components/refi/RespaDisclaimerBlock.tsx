// Phase 86 — the mandatory RESPA disclaimer, rendered read-only with a lock icon.
// Cannot be edited or removed; the server also appends it to every sent message.

import { IconLock } from '@tabler/icons-react';
import { RESPA_DISCLAIMER } from '@/lib/refi/constants';

export function RespaDisclaimerBlock() {
  return (
    <div className="rounded-[8px] border border-[#E24B4A] p-3 mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <IconLock size={13} className="text-[#E24B4A]" />
        <span className="text-[12px] font-semibold text-[#E24B4A]">Required disclaimer — cannot be removed</span>
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--c-label2)]">{RESPA_DISCLAIMER}</p>
    </div>
  );
}
