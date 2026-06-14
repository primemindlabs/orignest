'use client';

import { IconCalendarClock } from '@tabler/icons-react';

/** Phase 1.5 placeholder — direct Buffer scheduling lands next sprint. */
export function BufferConnectBanner() {
  return (
    <div className="bg-[#F9F7F4] rounded-xl border border-[#E8E4DE] px-4 py-3 flex items-center gap-3">
      <IconCalendarClock size={18} className="text-[#C9A95C] flex-shrink-0" />
      <p className="text-xs text-[#6B7B8D]">
        <span className="font-medium text-[#4A4A4A]">Auto-scheduling is coming soon.</span> Connect Buffer to push this week straight into your queue with dates and times pre-set. For now, copy each post and schedule it your way.
      </p>
    </div>
  );
}
