'use client';

import { useEffect, useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface Props {
  initialMessage: string;
  onMessageChange: (text: string) => void;
}

export function AEMessageEditor({ initialMessage, onMessageChange }: Props) {
  const [text, setText] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  // Re-seed when the upstream draft changes (e.g. days/AE selection updated).
  useEffect(() => {
    setText(initialMessage);
    onMessageChange(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  function update(v: string) {
    setText(v);
    onMessageChange(v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => update(e.target.value)}
        rows={5}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 resize-none"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-gray-400">{text.length} characters</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#C9A95C] transition-colors"
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? 'Copied' : 'Copy Message'}
        </button>
      </div>
    </div>
  );
}
