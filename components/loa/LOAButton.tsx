'use client';

import { IconBrain } from '@tabler/icons-react';

interface LOAButtonProps {
  onClick: () => void;
}

export function LOAButton({ onClick }: LOAButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Open LOA Business Intelligence"
      className="fixed bottom-6 right-24 z-40 flex items-center gap-2 rounded-full bg-white border border-gray-200 shadow-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <IconBrain size={20} className="text-violet-600" />
      <span>LOA</span>
    </button>
  );
}
