'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Send } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ashley', text: "Hi there! 👋 What can I help you with today?" },
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
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[13px] font-bold">A</span>
            </div>
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
                    ? 'bg-blue-600 text-white rounded-br-sm'
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
                    className="w-full text-left px-3 py-2 rounded-xl border border-blue-100 bg-blue-50 text-[12px] text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2"
                  >
                    <span className="text-blue-400">💬</span>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
                className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors"
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
        className="fixed right-6 bottom-6 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3L13 8H19L14.5 11.5L16.5 17L11 13.5L5.5 17L7.5 11.5L3 8H9L11 3Z" fill="white"/>
            <circle cx="17.5" cy="4.5" r="3" fill="#93C5FD"/>
            <text x="16" y="7" fontSize="4" fill="white" fontWeight="bold">1</text>
          </svg>
        )}
      </button>
    </>
  );
}
