'use client';

// Phase 123 — under-contract gold banner. Token-based dismiss (shows once).
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';

export function UnderContractBanner({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const dismiss = async () => {
    setVisible(false);
    try {
      await fetch(`/api/borrower-portal/${token}/celebration`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ celebrationType: 'under_contract' }) });
    } catch { /* non-blocking */ }
    onDismiss();
  };

  return (
    <div className="bg-[#FBF5E6] border border-[#E8D4A0] rounded-2xl px-5 py-3 flex items-center gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 rounded-full bg-[#C9A95C] flex items-center justify-center text-[14px] flex-shrink-0">🎉</div>
        <div>
          <p className="text-[13px] font-medium text-[#5A3E15]">You&rsquo;re under contract!</p>
          <p className="text-[12px] text-[#8C6B2A]">Your appraisal is in motion — you&rsquo;re in the home stretch.</p>
        </div>
      </div>
      <button onClick={dismiss} className="p-1 text-[#8C6B2A] hover:bg-[#E8D4A0] rounded"><IconX size={16} /></button>
    </div>
  );
}
