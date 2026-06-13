'use client';

// Contextual empty state for borrower-portal sections: explains WHEN the section
// unlocks (not just "no data") and offers an in-portal CTA to ask Ashley.
import { IconMessageChatbot } from '@tabler/icons-react';

export function PortalEmptyState({ icon, title, message, onAskAshley }: {
  icon: React.ReactNode;
  title: string;
  message: string;
  onAskAshley?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-8 text-center">
      <div className="w-11 h-11 rounded-full bg-[#FBF5E6] flex items-center justify-center mx-auto mb-3">{icon}</div>
      <p className="text-[14px] font-medium text-[#1A1816]">{title}</p>
      <p className="text-[12.5px] text-[#6B6560] mt-1.5 max-w-sm mx-auto leading-relaxed">{message}</p>
      {onAskAshley && (
        <button onClick={onAskAshley} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#C9A95C] text-[#8C6B2A] px-4 py-2 text-[13px] font-medium hover:bg-[#FBF5E6] transition-colors">
          <IconMessageChatbot size={15} /> Ask Ashley
        </button>
      )}
    </div>
  );
}
