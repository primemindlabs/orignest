'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Copy, Check, MessageSquare, Drama, BookText, Dumbbell, RotateCcw, Flag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { SCRIPT_CATEGORIES } from '@/lib/coach/scripts';
import { SCENARIOS, DRILLS, type Scenario } from '@/lib/coach/scenarios';

type Tab = 'coach' | 'roleplay' | 'scripts' | 'playbook';

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
  "Write a reactivation email for a lead I haven't talked to in 30 days",
] as const;

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'coach', label: 'Coach', icon: MessageSquare },
  { key: 'roleplay', label: 'Roleplay', icon: Drama },
  { key: 'scripts', label: 'Scripts', icon: BookText },
  { key: 'playbook', label: 'Playbook', icon: Dumbbell },
];

async function askCoach(prompt: string): Promise<string> {
  const res = await fetch('/api/ai/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get response');
  }
  const data = await res.json();
  return data.response as string;
}

export default function AICoachPage() {
  const [tab, setTab] = useState<Tab>('coach');
  // Coach chat is hoisted here so the Playbook tab can push prompts into it.
  const [coachMessages, setCoachMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "Hey — I'm your AshleyIQ Sales Coach. I can draft messages, sharpen your pitch, run roleplay drills, and help you close more loans, compliantly. Pick a tab above, or just ask me anything.",
      timestamp: new Date(),
    },
  ]);

  function pushToCoach(prompt: string) {
    setTab('coach');
    void runCoach(prompt);
  }

  const [coachLoading, setCoachLoading] = useState(false);
  async function runCoach(text: string) {
    const trimmed = text.trim();
    if (!trimmed || coachLoading) return;
    setCoachMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: trimmed, timestamp: new Date() }]);
    setCoachLoading(true);
    try {
      const reply = await askCoach(trimmed);
      setCoachMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-110px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[10px] bg-navy flex items-center justify-center">
          <Bot size={18} className="text-gold" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-black tracking-tight">Sales Coach</h1>
          <p className="text-xs text-label-2">Practice, scripts &amp; coaching · Powered by Claude · TCPA &amp; RESPA aware</p>
        </div>
      </div>

      {/* Inner tabs */}
      <div className="flex gap-0 border-b border-border mb-4 flex-shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${active ? 'text-[#8A6310]' : 'text-label-2 hover:text-black'}`}
              style={active ? { borderColor: '#C9A95C' } : { borderColor: 'transparent' }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'coach' && (
        <ChatPanel
          messages={coachMessages}
          loading={coachLoading}
          onSend={runCoach}
          showQuickPrompts
          placeholder="Ask me to draft a follow-up, explain a rule, or strategize your pipeline…"
        />
      )}
      {tab === 'roleplay' && <RoleplayPanel />}
      {tab === 'scripts' && <ScriptsPanel />}
      {tab === 'playbook' && <PlaybookPanel onCoach={pushToCoach} />}
    </div>
  );
}

// ── Reusable chat panel ───────────────────────────────────────────────────────
function ChatPanel({
  messages, loading, onSend, showQuickPrompts, placeholder, headerSlot,
}: {
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  showQuickPrompts?: boolean;
  placeholder: string;
  headerSlot?: React.ReactNode;
}) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied');
  }

  function submit(text?: string) {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setInput('');
    onSend(t);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {headerSlot}
      {showQuickPrompts && messages.length <= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="text-left text-xs text-label-2 px-3 py-2.5 rounded-[8px] bg-surface border border-border hover:bg-fill hover:text-black transition-colors leading-relaxed"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-gold" />
              </div>
            )}
            <div className={`group relative max-w-[85%] rounded-[12px] px-4 py-3 ${msg.role === 'user' ? 'bg-blue text-white rounded-tr-sm' : 'bg-surface border border-border text-black rounded-tl-sm shadow-card'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-label-3'}`}>
                {msg.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-[6px] bg-fill opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Copy"
                >
                  {copiedId === msg.id ? <Check size={12} className="text-green" /> : <Copy size={12} className="text-label-2" />}
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
                <span className="text-sm text-label-2">Thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 items-end flex-shrink-0">
        <div className="flex-1 bg-surface border border-border rounded-[12px] overflow-hidden focus-within:ring-2 focus-within:ring-blue/30 focus-within:border-blue transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={placeholder}
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-sm text-black placeholder:text-label-3 resize-none focus:outline-none bg-transparent"
          />
          <div className="flex items-center justify-end px-3 pb-2">
            <span className="text-[10px] text-label-3">Enter to send · Shift+Enter for newline</span>
          </div>
        </div>
        <button
          onClick={() => submit()}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-[10px] bg-blue text-white flex items-center justify-center hover:bg-blue/90 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// ── Roleplay panel ────────────────────────────────────────────────────────────
function RoleplayPanel() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [graded, setGraded] = useState(false);

  function start(s: Scenario) {
    setScenario(s);
    setGraded(false);
    setMessages([{ id: '0', role: 'assistant', content: s.opener, timestamp: new Date() }]);
  }

  function transcript(msgs: Message[]): string {
    return msgs.map((m) => `${m.role === 'user' ? 'Loan Officer' : 'Prospect'}: ${m.content}`).join('\n');
  }

  async function onSend(text: string) {
    if (!scenario) return;
    const next = [...messages, { id: Date.now().toString(), role: 'user' as const, content: text, timestamp: new Date() }];
    setMessages(next);
    setLoading(true);
    try {
      const prompt = `${scenario.rolePrompt}\n\nConversation so far:\n${transcript(next)}\n\nReply ONLY as the prospect, in character, in 1-3 sentences.`;
      const reply = await askCoach(prompt);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function endAndGrade() {
    if (!scenario || loading) return;
    setLoading(true);
    try {
      const prompt = `${scenario.rolePrompt}\n\nThe roleplay is now OVER. Break character completely and act as an expert mortgage sales coach. The scenario goal was: "${scenario.goal}".\n\nHere is the full conversation:\n${transcript(messages)}\n\nGrade the loan officer's performance from 1 to 10, then give: (1) what they did well, (2) three specific, actionable improvements, (3) one line they could have said better. Be direct and encouraging.`;
      const reply = await askCoach(prompt);
      setMessages((prev) => [...prev, { id: `grade-${Date.now()}`, role: 'assistant', content: `📊 Coach feedback\n\n${reply}`, timestamp: new Date() }]);
      setGraded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (!scenario) {
    return (
      <div className="flex-1 overflow-y-auto">
        <p className="text-sm text-label-2 mb-3">Pick a scenario to practice. The coach plays the prospect — type <span className="font-mono text-[12px] bg-fill px-1 rounded">COACH ME</span> mid-call for a hint, or end anytime for a graded breakdown.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => start(s)}
              className="text-left bg-surface border border-border rounded-[12px] p-4 hover:border-gold hover:shadow-card transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.difficulty === 'tough' ? 'bg-red/10 text-red' : s.difficulty === 'realistic' ? 'bg-gold/15 text-[#8A6310]' : 'bg-green/10 text-green'}`}>{s.difficulty}</span>
                <ChevronRight size={15} className="text-label-3 group-hover:text-gold transition-colors" />
              </div>
              <h3 className="text-[14px] font-semibold text-black">{s.title}</h3>
              <p className="text-[12px] text-label-3 mt-0.5">{s.persona}</p>
              <p className="text-[12px] text-label-2 mt-2">🎯 {s.goal}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ChatPanel
      messages={messages}
      loading={loading}
      onSend={onSend}
      placeholder={`Respond to ${scenario.title}…`}
      headerSlot={
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-[10px] bg-fill border border-border flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-black truncate">🎭 {scenario.title}</p>
            <p className="text-[11px] text-label-3 truncate">Goal: {scenario.goal}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={endAndGrade}
              disabled={loading || graded}
              className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-[8px] bg-navy text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Flag size={12} /> {graded ? 'Graded' : 'End & grade'}
            </button>
            <button
              onClick={() => setScenario(null)}
              className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-[8px] bg-surface border border-border text-label-2 hover:text-black transition-colors"
            >
              <RotateCcw size={12} /> New
            </button>
          </div>
        </div>
      }
    />
  );
}

// ── Scripts panel ─────────────────────────────────────────────────────────────
function ScriptsPanel() {
  const [openCat, setOpenCat] = useState<string>(SCRIPT_CATEGORIES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(id: string, body: string) {
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Script copied');
  }

  const channelColor: Record<string, string> = {
    call: 'bg-blue/10 text-blue', voicemail: 'bg-orange/10 text-orange', sms: 'bg-green/10 text-green', email: 'bg-gold/15 text-[#8A6310]',
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-3">
      {SCRIPT_CATEGORIES.map((cat) => {
        const open = openCat === cat.id;
        return (
          <div key={cat.id} className="bg-surface border border-border rounded-[12px] overflow-hidden">
            <button
              onClick={() => setOpenCat(open ? '' : cat.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-fill transition-colors text-left"
            >
              <div>
                <h3 className="text-[14px] font-semibold text-black">{cat.label}</h3>
                <p className="text-[12px] text-label-3">{cat.blurb}</p>
              </div>
              <ChevronRight size={16} className={`text-label-3 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {cat.scripts.map((s) => (
                  <div key={s.id} className="rounded-[10px] border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${channelColor[s.channel]}`}>{s.channel}</span>
                        <span className="text-[13px] font-medium text-black">{s.title}</span>
                      </div>
                      <button
                        onClick={() => copy(s.id, s.body)}
                        className="inline-flex items-center gap-1 text-[12px] text-label-2 hover:text-black transition-colors"
                      >
                        {copiedId === s.id ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                        {copiedId === s.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[12.5px] text-label-2 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-label-3 px-1">Scripts are starting points — personalize them and keep all required disclosures. Avoid promising specific rates, payments, or APRs.</p>
    </div>
  );
}

// ── Playbook panel ────────────────────────────────────────────────────────────
function PlaybookPanel({ onCoach }: { onCoach: (prompt: string) => void }) {
  const catColor: Record<string, string> = {
    mindset: 'bg-[#ede9fe] text-[#6d28d9]', discovery: 'bg-blue/10 text-blue', closing: 'bg-green/10 text-green', pipeline: 'bg-gold/15 text-[#8A6310]',
  };
  return (
    <div className="flex-1 overflow-y-auto">
      <p className="text-sm text-label-2 mb-3">Quick coaching drills. Tap “Coach me” to go deeper with your AI coach.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DRILLS.map((d) => (
          <div key={d.id} className="bg-surface border border-border rounded-[12px] p-4 flex flex-col">
            <span className={`self-start text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${catColor[d.category] ?? 'bg-fill text-label-2'}`}>{d.category}</span>
            <h3 className="text-[14px] font-semibold text-black">{d.title}</h3>
            <p className="text-[12.5px] text-label-2 mt-1 flex-1 leading-relaxed">{d.summary}</p>
            <button
              onClick={() => onCoach(d.coachPrompt)}
              className="mt-3 self-start inline-flex items-center gap-1 text-[12px] font-medium text-[#8A6310] hover:text-gold transition-colors"
            >
              Coach me <ChevronRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
