'use client';

import { useEffect, useRef } from 'react';
import { LOAMessage, type LOAMessageData } from './LOAMessage';

interface LOAChatWindowProps {
  messages: LOAMessageData[];
  loading: boolean;
}

export function LOAChatWindow({ messages, loading }: LOAChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-8">
          Ask LOA anything about your pipeline, realtors, or performance.
        </p>
      )}
      {messages.map((msg, i) => (
        <LOAMessage key={i} message={msg} />
      ))}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="animate-pulse">LOA is thinking…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
