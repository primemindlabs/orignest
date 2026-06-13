'use client';

/**
 * The single Ashley brain. One floating character → one chat that auto-routes each
 * message server-side (/api/ai/ashley) between coaching and business-intelligence,
 * renders BI source chips, and folds in the quick actions that used to be a separate
 * floating bar (New Loan, Pre-Approval, Rate Check, DSCR, Send Portal Link, ⌘K).
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send, MessageSquare, Command } from 'lucide-react';
import { IconFilePlus, IconBadge, IconTrendingDown, IconCalculator, IconLink, IconBolt } from '@tabler/icons-react';
import { AshleyAvatar } from '@/components/brand/AshleyAvatar';
import { SendPortalLinkDrawer } from '@/components/portal/SendPortalLinkDrawer';

interface Message { role: 'ashley' | 'user'; text: string; sources?: string[]; mode?: 'bi' | 'coach' }

const QUICK_PROMPTS = [
  'Summarize my pipeline',
  'How many loans funded last month?',
  'Build a follow-up for cold leads',
  'Which loans are at risk of falling out?',
];

interface QuickAction { id: string; label: string; icon: React.ElementType; href?: string; action?: 'portal' }
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new_loan', label: 'New Loan', icon: IconFilePlus, href: '/leads/new' },
  { id: 'preapproval', label: 'Pre-Approval', icon: IconBadge, href: '/pre-approval' },
  { id: 'rate_check', label: 'Rate Check', icon: IconTrendingDown, href: '/pricing' },
  { id: 'dscr', label: 'DSCR Calc', icon: IconCalculator, href: '/dscr-calculator' },
  { id: 'portal', label: 'Send Portal Link', icon: IconLink, action: 'portal' },
];

export function AskAshleyWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ashley', text: "Hi there! Ask me anything — I can pull your numbers, draft messages, or help with a deal." },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/ashley', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [...m, { role: 'ashley', text: data.error === 'Unauthorized' ? 'Please sign in again.' : 'Sorry, I hit a snag. Try again in a moment.' }]);
      } else {
        setMessages((m) => [...m, { role: 'ashley', text: data.answer ?? "I'm on it.", sources: data.sources, mode: data.mode }]);
      }
    } catch {
      setMessages((m) => [...m, { role: 'ashley', text: 'Sorry, I hit a snag. Try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  }

  function runAction(a: QuickAction) {
    setShowActions(false);
    if (a.action === 'portal') { setPortalOpen(true); return; }
    if (a.href) { setOpen(false); router.push(a.href); }
  }

  return (
    <>
      {open && (
        <div className="fixed right-6 bottom-24 w-[360px] z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '520px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <AshleyAvatar size={36} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-gray-900">Ashley</div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[11px] text-gray-400">Your AI brain · pipeline, drafting & deals</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-gold-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {m.text}
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.sources.map((s, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} onClick={() => send(q)} className="w-full text-left px-3 py-2 rounded-xl border border-gold-100 bg-gold-50 text-[12px] text-gold-700 hover:bg-gold-100 transition-colors flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-gold-400 flex-shrink-0" strokeWidth={1.75} />
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions (folded in from the old floating bar) */}
          {showActions && (
            <div className="px-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1.5">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.id} onClick={() => runAction(a)} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-gray-200 text-[12px] font-medium text-gray-700 hover:border-[#C9A95C] hover:bg-[#fdf8ee] transition-colors">
                    <Icon size={14} className="text-[#C9A95C]" /> {a.label}
                  </button>
                );
              })}
              <div className="col-span-2 flex items-center gap-1.5 px-1 py-1 text-[10px] text-gray-400"><Command size={11} /> Press ⌘K for the command palette</div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-gold-300 focus-within:ring-2 focus-within:ring-gold-100 transition-all">
              <button onClick={() => setShowActions((v) => !v)} aria-label="Quick actions" className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${showActions ? 'bg-[#C9A95C] text-white' : 'text-[#C9A95C] hover:bg-gold-50'}`}>
                <IconBolt size={15} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask Ashley anything…"
                className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 outline-none"
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading} className="w-7 h-7 rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-40 flex items-center justify-center transition-colors">
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">Ashley can make mistakes. Please review important information.</p>
          </div>
        </div>
      )}

      {/* The one floating character */}
      <button onClick={() => setOpen((v) => !v)} aria-label="Ashley" className="fixed right-6 bottom-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {open ? (
          <span className="w-14 h-14 rounded-full bg-navy flex items-center justify-center"><X className="w-5 h-5 text-white" /></span>
        ) : (
          <AshleyAvatar size={56} ring />
        )}
      </button>

      {portalOpen && <SendPortalLinkDrawer onClose={() => setPortalOpen(false)} />}
    </>
  );
}
