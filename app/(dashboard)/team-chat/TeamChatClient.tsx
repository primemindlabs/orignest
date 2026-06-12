'use client';

/**
 * Phase 88 — Team Chat. Internal team messaging with channels, @mentions, loan-context
 * linking, reactions and a compliance archive. Live updates via 5s polling (the app
 * uses Clerk, not Supabase auth, so RLS-filtered Realtime isn't available client-side —
 * same approach as the Phase 31 loan chat).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Hash, Lock, Send, Plus, Link2, X, Download, FileText } from 'lucide-react';
import { ComplianceArchivedBanner } from '@/components/team-chat/ComplianceArchivedBanner';

const REACTIONS = ['👍', '✅', '🔑', '⚠️', '❓'] as const;

interface Channel { id: string; name: string; description: string | null; channel_type: string; is_default: boolean }
interface Member { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; role: string | null }
interface Loan { id: string; first_name: string | null; last_name: string | null; stage: string | null }
interface Reaction { emoji: string; count: number; mine: boolean }
interface Message {
  id: string;
  body: string;
  lead_id: string | null;
  mentions: string[];
  created_at: string;
  user_id: string;
  sender: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  lead: { id: string; first_name: string | null; last_name: string | null; stage: string | null } | null;
  reactions: Reaction[];
}

function fullName(p: { first_name: string | null; last_name: string | null } | null, fallback = 'Unknown'): string {
  if (!p) return fallback;
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || fallback;
}
function initials(p: { first_name: string | null; last_name: string | null } | null): string {
  return `${p?.first_name?.[0] ?? ''}${p?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}
function time(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Render a body, bolding @mention tokens in gold. */
function renderBody(body: string) {
  return body.split(/(@[A-Za-z0-9.]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-[var(--c-gold-deep)]">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function TeamChatClient({ role }: { role: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = role === 'admin';

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');
  const [linkedLead, setLinkedLead] = useState<Loan | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showLoanPicker, setShowLoanPicker] = useState(false);
  const [loanQuery, setLoanQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = useMemo(() => channels.find((c) => c.id === activeId) ?? null, [channels, activeId]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    const res = await fetch('/api/team-chat/channels');
    if (!res.ok) return;
    const data = await res.json();
    setChannels(data.channels ?? []);
    setMembers(data.members ?? []);
    setLoans(data.loans ?? []);
    setMe(data.me ?? null);
    const wanted = searchParams.get('c');
    setActiveId((cur) => cur ?? (wanted && (data.channels ?? []).some((c: Channel) => c.id === wanted) ? wanted : data.channels?.[0]?.id ?? null));
  }, [searchParams]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // ── Message polling ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    const res = await fetch(`/api/team-chat/channels/${activeId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    loadMessages();
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // ── Mention autocomplete ─────────────────────────────────────────────────────
  function onInputChange(value: string) {
    setInput(value);
    const caret = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = before.match(/@([A-Za-z0-9.]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    return members
      .filter((mm) => fullName(mm).toLowerCase().replace(/[^a-z0-9]/g, '').includes(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, members]);

  function pickMention(mm: Member) {
    const caret = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, caret).replace(/@([A-Za-z0-9.]*)$/, '');
    const handle = `@${(mm.first_name ?? '').replace(/\s/g, '')}${(mm.last_name ?? '').replace(/\s/g, '')} `;
    const next = before + handle + input.slice(caret);
    setInput(next);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function send() {
    const body = input.trim();
    if (!body || sending || !activeId) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/team-chat/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, lead_id: linkedLead?.id ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setInput('');
      setLinkedLead(null);
      setMentionQuery(null);
      await loadMessages();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    if (!activeId) return;
    await fetch(`/api/team-chat/channels/${activeId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, emoji }),
    });
    await loadMessages();
  }

  async function createChannel() {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch('/api/team-chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, channel_type: 'public' }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewName('');
      setCreating(false);
      await bootstrap();
      if (data.channel?.id) setActiveId(data.channel.id);
    }
  }

  const filteredLoans = useMemo(() => {
    const q = loanQuery.toLowerCase();
    return loans.filter((l) => fullName(l).toLowerCase().includes(q)).slice(0, 8);
  }, [loans, loanQuery]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[480px]">
      {/* Channel list */}
      <div className="w-[200px] flex-shrink-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col">
        <div className="px-3 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--c-label2)] uppercase tracking-wide">Channels</span>
          <button onClick={() => setCreating((c) => !c)} aria-label="New channel" className="p-1 rounded-[6px] text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)]">
            <Plus size={15} />
          </button>
        </div>
        {creating && (
          <div className="p-2 border-b border-[var(--c-border)] flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createChannel(); }}
              placeholder="new-channel"
              className="flex-1 min-w-0 text-[12px] bg-[var(--c-fill)] rounded-[8px] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
              autoFocus
            />
            <button onClick={createChannel} className="text-[12px] text-[var(--c-gold-deep)] font-medium px-1">Add</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {channels.map((c) => {
            const active = c.id === activeId;
            const Icon = c.channel_type === 'public' ? Hash : Lock;
            return (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); router.replace(`/team-chat?c=${c.id}`); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[13px] text-left transition-colors border-l-[2px] ${active ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] border-[var(--c-gold)] font-medium' : 'text-[var(--c-label)] hover:bg-[var(--c-fill)] border-transparent'}`}
              >
                <Icon size={13} className="flex-shrink-0 opacity-70" />
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
          {channels.length === 0 && <p className="text-[12px] text-[var(--c-label2)] text-center py-6">Loading channels…</p>}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-w-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--c-border)] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeChannel?.channel_type === 'public' ? <Hash size={15} className="text-[var(--c-label2)]" /> : <Lock size={15} className="text-[var(--c-label2)]" />}
              <span className="text-[14px] font-semibold text-[var(--c-text)] truncate">{activeChannel?.name ?? 'Team Chat'}</span>
              {activeChannel?.description && <span className="text-[12px] text-[var(--c-label2)] truncate hidden sm:inline">— {activeChannel.description}</span>}
            </div>
            {isAdmin && activeId && (
              <a
                href={`/api/team-chat/export?channel_id=${activeId}`}
                className="flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)] flex-shrink-0"
                title="Export channel (CSV)"
              >
                <Download size={13} /> Export
              </a>
            )}
          </div>
          <ComplianceArchivedBanner />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && <p className="text-[13px] text-[var(--c-label2)] text-center py-10">No messages yet. Start the conversation.</p>}
          {messages.map((m) => (
            <div key={m.id} className="flex gap-2.5 group">
              <div className="w-7 h-7 rounded-full bg-[var(--c-gold)] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                {initials(m.sender)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--c-text)]">{fullName(m.sender)}</span>
                  <span className="text-[10px] text-[var(--c-label2)]">{time(m.created_at)}</span>
                </div>
                <div className="text-[13px] leading-relaxed text-[var(--c-text)] whitespace-pre-wrap break-words">{renderBody(m.body)}</div>
                {m.lead && (
                  <button
                    onClick={() => router.push(`/leads/${m.lead!.id}`)}
                    className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] border border-[var(--c-gold)] text-[var(--c-gold-deep)] rounded-full px-2 py-0.5 hover:bg-[var(--c-gold-light)]"
                  >
                    <FileText size={11} /> {fullName(m.lead, 'Loan')} · {m.lead.stage ?? ''}
                  </button>
                )}
                {/* Reactions */}
                <div className="flex items-center gap-1 mt-1.5">
                  {m.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      onClick={() => react(m.id, r.emoji)}
                      className={`text-[11px] rounded-full px-1.5 py-0.5 border ${r.mine ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] bg-[var(--c-fill)]'}`}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    {REACTIONS.map((e) => (
                      <button key={e} onClick={() => react(m.id, e)} className="text-[12px] rounded-full px-1 hover:bg-[var(--c-fill)]" title={`React ${e}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--c-border)] p-3 space-y-2 relative">
          {linkedLead && (
            <span className="inline-flex items-center gap-1.5 text-[11px] border border-[var(--c-gold)] text-[var(--c-gold-deep)] rounded-full px-2 py-0.5">
              <FileText size={11} /> {fullName(linkedLead, 'Loan')}
              <button onClick={() => setLinkedLead(null)} aria-label="Remove loan link"><X size={11} /></button>
            </span>
          )}
          {err && <p className="text-[11px] text-[var(--c-danger)]">{err}</p>}

          {/* Mention dropdown */}
          {mentionMatches.length > 0 && (
            <div className="absolute bottom-[60px] left-3 w-[240px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] shadow-xl overflow-hidden z-10">
              {mentionMatches.map((mm) => (
                <button key={mm.id} onClick={() => pickMention(mm)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left hover:bg-[var(--c-fill)]">
                  <span className="w-5 h-5 rounded-full bg-[var(--c-gold)] flex items-center justify-center text-[9px] font-bold text-white">{initials(mm)}</span>
                  {fullName(mm)}
                </button>
              ))}
            </div>
          )}

          {/* Loan picker */}
          {showLoanPicker && (
            <div className="absolute bottom-[60px] left-3 w-[280px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] shadow-xl overflow-hidden z-10">
              <input
                value={loanQuery}
                onChange={(e) => setLoanQuery(e.target.value)}
                placeholder="Search a loan…"
                className="w-full text-[12px] border-b border-[var(--c-border)] px-2.5 py-2 focus:outline-none"
                autoFocus
              />
              <div className="max-h-[180px] overflow-y-auto">
                {filteredLoans.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setLinkedLead(l); setShowLoanPicker(false); setLoanQuery(''); }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] text-left hover:bg-[var(--c-fill)]"
                  >
                    <span className="truncate">{fullName(l, 'Loan')}</span>
                    <span className="text-[10px] text-[var(--c-label2)]">{l.stage}</span>
                  </button>
                ))}
                {filteredLoans.length === 0 && <p className="text-[11px] text-[var(--c-label2)] text-center py-3">No loans found.</p>}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button onClick={() => setShowLoanPicker((s) => !s)} aria-label="Link a loan" className="p-2 rounded-[8px] text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)]">
              <Link2 size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={activeChannel ? `Message #${activeChannel.name}…  (@ to mention)` : 'Message…'}
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none text-[13px] bg-[var(--c-fill)] rounded-[10px] px-3 py-2.5 max-h-[120px] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              <Send size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
