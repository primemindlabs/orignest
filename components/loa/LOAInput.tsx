'use client';

import { KeyboardEvent } from 'react';
import { IconSend } from '@tabler/icons-react';

interface LOAInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  loading: boolean;
  disabled: boolean;
}

export function LOAInput({ value, onChange, onSubmit, loading, disabled }: LOAInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  return (
    <div className="border-t border-gray-100 p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Daily limit reached' : 'Ask about your pipeline…'}
          disabled={disabled || loading}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
        />
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim() || loading || disabled}
          aria-label="Send"
          className="rounded-xl bg-gray-900 p-2.5 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          <IconSend size={16} />
        </button>
      </div>
    </div>
  );
}
