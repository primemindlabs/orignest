'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clsx } from 'clsx';
import {
  MessageSquare,
  Mail,
  Instagram,
  Facebook,
  PhoneMissed,
  Search,
  Plus,
  Shield,
  AlertTriangle,
  Send,
  Paperclip,
  Sparkles,
  ExternalLink,
  Phone,
  RefreshCw,
  CheckCheck,
  Check,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────

type Channel = 'sms' | 'email' | 'instagram' | 'facebook' | 'voicemail';
type FilterTab = 'all' | Channel;

interface InboundMessage {
  id: string;
  org_id: string;
  lead_id: string | null;
  channel: Channel;
  from_address: string;
  to_address: string;
  body: string;
  raw_payload: Record<string, unknown> | null;
  read_at: string | null;
  replied_at: string | null;
  lo_id: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  stage: string;
  sms_consent: boolean;
}

interface ThreadItem {
  leadId: string | null;
  contactName: string;
  contactInitials: string;
  lastMessage: string;
  lastChannel: Channel;
  lastTime: string;
  unreadCount: number;
  messages: InboundMessage[];
  lead: Lead | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function channelIcon(channel: Channel, size = 14) {
  switch (channel) {
    case 'sms':        return <MessageSquare size={size} className="text-blue" />;
    case 'email':      return <Mail size={size} className="text-[#C9A95C]" />;
    case 'instagram':  return <Instagram size={size} className="text-[#E1306C]" />;
    case 'facebook':   return <Facebook size={size} className="text-[#1877F2]" />;
    case 'voicemail':  return <PhoneMissed size={size} className="text-orange" />;
  }
}

function channelLabel(channel: Channel): string {
  switch (channel) {
    case 'sms':       return 'SMS';
    case 'email':     return 'Email';
    case 'instagram': return 'Instagram';
    case 'facebook':  return 'Facebook';
    case 'voicemail': return 'Voicemail';
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

const STAGE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'gold'> = {
  new_inquiry: 'neutral',
  pre_qual: 'info',
  application: 'info',
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
  closed: 'success',
  declined: 'danger',
  withdrawn: 'neutral',
};

// ─── Thread list panel ────────────────────────────────────────────────────────

function ThreadListItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: ThreadItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-3 border-b border-[rgba(60,60,67,0.08)] transition-colors',
        'relative flex items-start gap-3',
        isSelected ? 'bg-blue/6' : 'hover:bg-[rgba(60,60,67,0.03)]',
        hasUnread && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-blue before:rounded-r'
      )}
    >
      {/* Avatar */}
      <div className={clsx(
        'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold',
        isSelected ? 'bg-blue text-white' : 'bg-[rgba(60,60,67,0.08)] text-label-2'
      )}>
        {thread.contactInitials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={clsx('text-[13px] truncate', hasUnread ? 'font-semibold text-black' : 'font-medium text-black')}>
            {thread.contactName}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {channelIcon(thread.lastChannel, 12)}
            <span className="text-[11px] text-label-3">
              {formatDistanceToNow(new Date(thread.lastTime), { addSuffix: false })}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={clsx('text-[12px] truncate', hasUnread ? 'text-black' : 'text-label-2')}>
            {thread.lastMessage}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 w-5 h-5 bg-blue rounded-full flex items-center justify-center text-[10px] font-bold text-white">
              {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, isOutbound }: { msg: InboundMessage; isOutbound: boolean }) {
  return (
    <div className={clsx('flex items-end gap-2 max-w-[75%]', isOutbound ? 'ml-auto flex-row-reverse' : '')}>
      <div className={clsx(
        'px-3.5 py-2.5 rounded-[18px] text-[14px] leading-snug',
        isOutbound
          ? 'bg-blue text-white rounded-br-[4px]'
          : 'bg-white border border-[rgba(60,60,67,0.12)] text-black rounded-bl-[4px]'
      )}>
        {msg.body}
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 pb-0.5">
        {channelIcon(msg.channel, 11)}
        <span className="text-[10px] text-label-3">
          {format(new Date(msg.created_at), 'h:mm a')}
        </span>
        {isOutbound && msg.channel === 'sms' && (
          <span className="text-[10px] text-label-3">
            {msg.replied_at ? <CheckCheck size={10} className="text-blue" /> : <Check size={10} />}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

interface ComposerProps {
  lead: Lead | null;
  thread: ThreadItem;
  onSent: () => void;
}

function Composer({ lead, thread, onSent }: ComposerProps) {
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tcpaBlocked = channel === 'sms' && lead && !lead.sms_consent;

  async function handleSend() {
    if (!body.trim() || sending || tcpaBlocked) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead?.id ?? null,
          channel,
          body: body.trim(),
          toAddress: channel === 'sms' ? lead?.phone : lead?.email,
        }),
      });
      if (!res.ok) {
        const { error: e } = await res.json() as { error: string };
        setError(e ?? 'Send failed');
      } else {
        setBody('');
        onSent();
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  }

  async function handleAiDraft() {
    setAiLoading(true);
    try {
      const recentMessages = thread.messages
        .slice(-6)
        .map((m) => `${m.from_address}: ${m.body}`)
        .join('\n');
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a helpful mortgage loan officer assistant. Based on this conversation history, draft a professional, friendly reply in 1-3 sentences. Conversation:\n${recentMessages}\n\nDraft a reply for the loan officer:`,
        }),
      });
      if (res.ok) {
        const { reply } = await res.json() as { reply: string };
        setBody(reply ?? '');
        textareaRef.current?.focus();
      }
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="border-t border-[rgba(60,60,67,0.10)] bg-white p-4 space-y-3">
      {/* TCPA warning */}
      {tcpaBlocked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red/8 border border-red/20 rounded-[10px] text-[12px] text-red font-medium">
          <AlertTriangle size={14} />
          SMS consent not on file. Obtain written consent before sending SMS.
        </div>
      )}

      {/* Channel selector */}
      <div className="flex items-center gap-2">
        {(['sms', 'email'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors',
              channel === ch
                ? 'bg-blue text-white'
                : 'bg-[rgba(60,60,67,0.07)] text-label-2 hover:bg-[rgba(60,60,67,0.12)]'
            )}
          >
            {channelIcon(ch, 11)}
            {channelLabel(ch)}
          </button>
        ))}

        {/* TCPA consent indicator */}
        {lead && (
          <div className={clsx(
            'ml-auto flex items-center gap-1 text-[11px] font-medium',
            lead.sms_consent ? 'text-green' : 'text-orange'
          )}>
            <Shield size={12} />
            {lead.sms_consent ? 'TCPA consent on file' : 'No SMS consent'}
          </div>
        )}
      </div>

      {/* Text area */}
      <div className={clsx(
        'flex items-end gap-2 px-3 py-2.5 rounded-[12px] border transition-shadow',
        'border-[rgba(60,60,67,0.15)] focus-within:shadow-input focus-within:border-blue/40',
        'bg-[rgba(60,60,67,0.03)]'
      )}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          placeholder={channel === 'sms' ? 'Type an SMS…' : 'Type an email…'}
          disabled={tcpaBlocked ?? false}
          rows={2}
          className="flex-1 bg-transparent resize-none text-[14px] text-black placeholder:text-label-3 outline-none min-h-[40px] max-h-[120px]"
        />
        <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
          {channel === 'email' && (
            <button
              className="p-1.5 rounded-[8px] text-label-3 hover:text-label-2 hover:bg-[rgba(60,60,67,0.07)] transition-colors"
              aria-label="Attach file"
            >
              <Paperclip size={15} />
            </button>
          )}
          <button
            onClick={handleAiDraft}
            disabled={aiLoading}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors',
              'text-gold hover:bg-gold/8',
              aiLoading && 'opacity-60'
            )}
            aria-label="AI Draft"
          >
            <Sparkles size={13} />
            {aiLoading ? 'Drafting…' : 'AI Draft'}
          </button>
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending || (tcpaBlocked ?? false)}
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
              body.trim() && !tcpaBlocked
                ? 'bg-blue text-white hover:bg-blue/90'
                : 'bg-[rgba(60,60,67,0.08)] text-label-3 cursor-not-allowed'
            )}
            aria-label="Send"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-red">{error}</p>
      )}
    </div>
  );
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────

export default function InboxPage() {
  const sb = createClient();
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const { data: msgs } = await sb
      .from('inbound_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    const leadIds = [...new Set((msgs ?? []).map((m) => m.lead_id).filter(Boolean))] as string[];

    const { data: leadsData } = leadIds.length
      ? await sb.from('leads').select('id,first_name,last_name,email,phone,stage,sms_consent').in('id', leadIds)
      : { data: [] };

    setMessages((msgs ?? []) as InboundMessage[]);
    setLeads((leadsData ?? []) as Lead[]);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    void loadData();

    const sub = sb
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbound_messages' }, (payload) => {
        setMessages((prev) => [payload.new as InboundMessage, ...prev]);
      })
      .subscribe();

    return () => { void sb.removeChannel(sub); };
  }, [loadData, sb]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedLeadId, messages]);

  // Group messages into threads by lead_id (or from_address for unmatched)
  const threads: ThreadItem[] = (() => {
    const map = new Map<string, ThreadItem>();

    const filtered = messages.filter((m) => {
      if (filter !== 'all' && m.channel !== filter) return false;
      return true;
    });

    for (const msg of filtered) {
      const key = msg.lead_id ?? `unmatched:${msg.from_address}`;
      const lead = leads.find((l) => l.id === msg.lead_id) ?? null;
      const name = lead ? `${lead.first_name} ${lead.last_name}` : msg.from_address;

      if (!map.has(key)) {
        map.set(key, {
          leadId: msg.lead_id,
          contactName: name,
          contactInitials: initials(name),
          lastMessage: msg.body,
          lastChannel: msg.channel,
          lastTime: msg.created_at,
          unreadCount: msg.read_at ? 0 : 1,
          messages: [msg],
          lead,
        });
      } else {
        const t = map.get(key)!;
        t.messages.push(msg);
        if (!msg.read_at) t.unreadCount++;
      }
    }

    return [...map.values()].sort(
      (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    );
  })();

  const searchedThreads = search.trim()
    ? threads.filter((t) =>
        t.contactName.toLowerCase().includes(search.toLowerCase()) ||
        t.lastMessage.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  const selectedThread = selectedLeadId
    ? threads.find((t) => t.leadId === selectedLeadId) ?? null
    : null;

  const selectedLead = selectedThread?.lead ?? null;

  async function markRead(leadId: string) {
    await sb
      .from('inbound_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .is('read_at', null);
    void loadData();
  }

  const FILTER_TABS: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'sms', label: 'SMS' },
    { value: 'email', label: 'Email' },
    { value: 'instagram', label: 'Social' },
    { value: 'voicemail', label: 'Missed Calls' },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] -m-6 overflow-hidden">
      {/* ── Left: Thread list ── */}
      <div className="w-[35%] min-w-[280px] max-w-[380px] flex flex-col border-r border-[rgba(60,60,67,0.10)] bg-white">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[rgba(60,60,67,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-bold text-black">Inbox</h2>
            <button className="flex items-center gap-1 h-7 px-2.5 rounded-[8px] bg-blue text-white text-[12px] font-medium hover:bg-blue/90 transition-colors">
              <Plus size={13} />
              New
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-label-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full h-8 pl-8 pr-3 rounded-[8px] bg-[rgba(60,60,67,0.06)] text-[13px] text-black placeholder:text-label-3 outline-none focus:bg-[rgba(60,60,67,0.09)] transition-colors"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[rgba(60,60,67,0.08)] overflow-x-auto no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={clsx(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap',
                filter === tab.value
                  ? 'bg-blue text-white'
                  : 'text-label-2 hover:bg-[rgba(60,60,67,0.07)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-label-3 text-[13px]">
              Loading…
            </div>
          ) : searchedThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <MessageSquare size={28} className="text-label-3" />
              <p className="text-[13px] text-label-3">No messages yet</p>
            </div>
          ) : (
            searchedThreads.map((thread) => (
              <ThreadListItem
                key={thread.leadId ?? thread.contactName}
                thread={thread}
                isSelected={selectedLeadId === thread.leadId}
                onClick={() => {
                  setSelectedLeadId(thread.leadId);
                  if (thread.leadId) void markRead(thread.leadId);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Conversation ── */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col bg-bg min-w-0">
          {/* Contact header */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[rgba(60,60,67,0.10)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center text-[14px] font-semibold text-blue flex-shrink-0">
                {selectedThread.contactInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold text-black">{selectedThread.contactName}</span>
                  {selectedLead && (
                    <Badge variant={STAGE_VARIANT[selectedLead.stage] ?? 'neutral'} size="sm">
                      {STAGE_LABELS[selectedLead.stage] ?? selectedLead.stage}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {selectedLead?.phone && (
                    <span className="text-[12px] text-label-2 flex items-center gap-1">
                      <Phone size={10} />
                      {selectedLead.phone}
                    </span>
                  )}
                  {selectedLead?.email && (
                    <span className="text-[12px] text-label-2 flex items-center gap-1">
                      <Mail size={10} />
                      {selectedLead.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {selectedLead && (
              <Link
                href={`/leads/${selectedLead.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[rgba(60,60,67,0.07)] text-[12px] font-medium text-label-2 hover:bg-[rgba(60,60,67,0.12)] transition-colors"
              >
                <ExternalLink size={12} />
                Open Lead
              </Link>
            )}
          </div>

          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {[...selectedThread.messages].reverse().map((msg) => (
              <MessageBubble key={msg.id} msg={msg} isOutbound={false} />
            ))}
            <div ref={threadEndRef} />
          </div>

          {/* Composer */}
          <Composer lead={selectedLead} thread={selectedThread} onSent={loadData} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-bg gap-3">
          <div className="w-14 h-14 rounded-[20px] bg-blue/8 flex items-center justify-center">
            <MessageSquare size={26} className="text-blue" />
          </div>
          <p className="text-[15px] font-semibold text-black">Select a conversation</p>
          <p className="text-[13px] text-label-2">Choose a thread on the left to start messaging</p>
        </div>
      )}
    </div>
  );
}
