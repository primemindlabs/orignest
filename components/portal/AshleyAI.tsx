'use client';

// Phase 123 — Ask Ashley (borrower-facing) chat. Token-based.
import { useState } from 'react';

const QUICK_QUESTIONS = [
  'How much cash do I need at closing?',
  'What does conditional approval mean?',
  'Can I buy a rental in 12 months?',
  'What is DSCR?',
  'Why did my credit score change?',
  'Should I refinance later?',
];

export function AshleyAI({ token }: { token: string }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`/api/borrower-portal/${token}/ashley`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question }) });
      const data = await res.json().catch(() => ({}));
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message ?? 'Sorry, please try again.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I had trouble. Please try again or message your loan officer.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-[#C9A95C] flex items-center justify-center text-[12px] font-medium text-[#5A3E15] flex-shrink-0">AI</div>
        <div>
          <p className="text-[13px] font-medium text-[#1A1816]">Ask Ashley — 24/7</p>
          <p className="text-[11px] text-[#9B9590]">Instant answers · no hold music</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-[#F4F2EF] rounded-lg p-4 mb-4">
          <p className="text-[12px] font-medium text-[#6B6560] mb-1">How can I help you today?</p>
          <p className="text-[13px] text-[#1A1816] leading-relaxed">I can answer questions about your loan, explain mortgage terms, estimate your costs, and help you plan your next move.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block px-4 py-3 rounded-xl text-[13px] leading-relaxed max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#C9A95C] text-[#5A3E15]' : 'bg-[#F4F2EF] text-[#1A1816]'}`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="bg-[#F4F2EF] rounded-xl px-4 py-3 text-[13px] text-[#9B9590] w-16">…</div>}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        {QUICK_QUESTIONS.slice(0, 4).map((q) => (
          <button key={q} onClick={() => sendMessage(q)} className="px-3 py-[5px] bg-white border border-[#EDEAE4] rounded-full text-[12px] text-[#6B6560] hover:border-[#C9A95C] hover:text-[#8C6B2A] transition-colors">{q}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} placeholder="Ask anything about your loan…" className="flex-1 px-4 py-2 text-[13px] border border-[#EDEAE4] rounded-xl focus:outline-none focus:border-[#C9A95C]" />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="px-4 py-2 bg-[#C9A95C] text-[#5A3E15] rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-[#D9B96E] transition-colors">Send</button>
      </div>
      <p className="text-[10px] text-[#9B9590] mt-2">Ashley can make mistakes. Your loan officer has your complete picture.</p>
    </div>
  );
}
