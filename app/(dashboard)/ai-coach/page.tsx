'use client';

import { useState } from 'react';
import { Bot, Send, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Write a follow-up email for a lead who went quiet after the pre-qual call',
  'Draft a polite SMS for a borrower whose TRID LE deadline is tomorrow',
  'Help me explain why rates moved up today to a frustrated borrower',
  'Write a reactivation email for a lead I haven\'t talked to in 30 days',
  'What questions should I ask on a first call with a purchase lead?',
  'Draft a referral thank-you email for a real estate partner',
] as const;

export default function AICoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "Hi! I'm your Conduit AI Coach, powered by Claude. I'm here to help you close more loans — faster and compliantly. I can draft follow-up messages, help with TRID questions, strategize your pipeline, and more. What do you need?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;

    setInput('');
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to get response');
      }

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-navy flex items-center justify-center">
            <Bot size={18} className="text-gold" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-black tracking-tight">AI Coach</h1>
            <p className="text-xs text-label-2">Powered by Claude · TCPA & RESPA aware</p>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="text-left text-xs text-label-2 px-3 py-2.5 rounded-[8px] bg-surface border border-border hover:bg-fill hover:text-black transition-colors leading-relaxed"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-gold" />
              </div>
            )}

            <div
              className={`group relative max-w-[85%] rounded-[12px] px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue text-white rounded-tr-sm'
                  : 'bg-surface border border-border text-black rounded-tl-sm shadow-card'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <p
                className={`text-[10px] mt-1.5 ${
                  msg.role === 'user' ? 'text-white/60' : 'text-label-3'
                }`}
              >
                {msg.timestamp.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>

              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-[6px] bg-fill opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Copy"
                >
                  {copiedId === msg.id ? (
                    <Check size={12} className="text-green" />
                  ) : (
                    <Copy size={12} className="text-label-2" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-gold" />
            </div>
            <div className="bg-surface border border-border rounded-[12px] rounded-tl-sm px-4 py-3 shadow-card">
              <div className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin text-label-2" />
                <span className="text-sm text-label-2">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 bg-surface border border-border rounded-[12px] overflow-hidden focus-within:ring-2 focus-within:ring-blue/30 focus-within:border-blue transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask me to draft a follow-up, explain a compliance rule, or strategize your pipeline..."
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-sm text-black placeholder:text-label-3 resize-none focus:outline-none bg-transparent"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-[10px] text-label-3">
              Press Enter to send · Shift+Enter for new line
            </p>
            <span className="text-[10px] text-label-3">{input.length}/2000</span>
          </div>
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-[10px] bg-blue text-white flex items-center justify-center hover:bg-blue/90 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      <p className="text-[10px] text-label-3 text-center mt-2">
        AI Coach can make mistakes. Always verify compliance matters with a legal professional.
      </p>
    </div>
  );
}
