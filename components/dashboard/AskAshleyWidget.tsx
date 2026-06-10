'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Maximize2, Send, MessageSquare } from 'lucide-react';
import { IconFilePlus } from '@tabler/icons-react';
import { AshleyAvatar } from '@/components/brand/AshleyAvatar';

interface Message {
  role: 'ashley' | 'user';
  text: string;
}

const QUICK_PROMPTS = [
  "Show me yesterday's conversations",
  'Build a follow-up campaign for cold leads',
  'Which loans are at risk of falling out of contract?',
  'Summarize my pipeline',
];

export function AskAshleyWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ashley', text: 'Hi there! What can I help you with today?' },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'ashley', text: data.response ?? "I'm on it — let me pull that up for you." }]);
    } catch {
      setMessages((m) => [...m, { role: 'ashley', text: "Sorry, I hit a snag. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating panel */}
      {open && (
        <div className="fixed right-6 bottom-20 w-[340px] z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <AshleyAvatar size={36} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-gray-900">Ask Ashley</div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="text-[11px] text-gray-400">Online</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gold-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick prompts (only show if first message) */}
            {messages.length === 1 && (
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="w-full text-left px-3 py-2 rounded-xl border border-gold-100 bg-gold-50 text-[12px] text-gold-700 hover:bg-gold-100 transition-colors flex items-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" strokeWidth={1.75} />
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            {/* Persistent quick actions (Phase 90) */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                onClick={() => router.push('/leads/new?type=application')}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#876830] bg-[#fdf8ee] border border-[#C9A95C]/30 rounded-full px-2.5 py-1 hover:bg-[#f9f1dd] transition-colors"
              >
                <IconFilePlus size={12} />
                New Loan Application
              </button>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-gold-300 focus-within:ring-2 focus-within:ring-gold-100 transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask Ashley anything..."
                className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 outline-none"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">Ashley can make mistakes. Please review important information.</p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask Ashley"
        className="fixed right-6 bottom-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? (
          <span className="w-14 h-14 rounded-full bg-navy flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </span>
        ) : (
          <AshleyAvatar size={56} ring />
        )}
      </button>
    </>
  );
}
