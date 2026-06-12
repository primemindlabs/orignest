'use client';

import { QUICK_QUESTIONS } from '@/lib/loa/quick-questions';

interface LOAQuickChipsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function LOAQuickChips({ onSelect, disabled }: LOAQuickChipsProps) {
  return (
    <div className="border-t border-gray-100 px-4 py-2 overflow-x-auto">
      <div className="flex gap-2 pb-1 whitespace-nowrap">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            disabled={disabled}
            className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-40 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
