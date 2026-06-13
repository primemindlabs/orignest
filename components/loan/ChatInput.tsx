'use client';

import { useState, KeyboardEvent } from 'react';
import { IconSend } from '@tabler/icons-react';

export function ChatInput({ onSend, disabled }: { onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(t);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-gray-100 p-3 flex items-end gap-2 bg-[#FAFAF8]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || sending}
        rows={2}
        placeholder="Message your team about this file…"
        className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={!text.trim() || sending || disabled}
        aria-label="Send"
        className="rounded-xl bg-[#C9A95C] p-2.5 text-white hover:brightness-95 disabled:opacity-40 transition"
      >
        <IconSend size={16} />
      </button>
    </div>
  );
}
