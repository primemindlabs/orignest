'use client';

/**
 * Phase 144 — per-lead Ashley Concierge panel: live transcript, per-lead autonomy
 * mode, draft approval, and a dry-run simulator to preview/verify replies.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, CheckCircle2, AlertTriangle, FlaskConical, Bot } from 'lucide-react';

interface Msg { id: string; role: string; body: string; gated: boolean; gate_reason: string | null; sent: boolean; created_at: string; tool_trace: { name: string }[] | null }
interface Conv { autonomy_mode: string; status: string; escalation_reason: string | null; message_count: number }

export function ConciergePanel({ leadId }: { leadId: string }) {
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/concierge/${leadId}`).then((r) => r.json()).catch(() => ({}));
    setConv(j.conversation ?? null);
    setMsgs(j.messages ?? []);
    setLoading(false);
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const setMode = async (mode: string) => {
    setBusy(true);
    await fetch(`/api/concierge/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_mode', mode }) });
    setBusy(false); load();
  };
  const approve = async (message_id: string) => {
    setBusy(true);
    const r = await fetch(`/api/concierge/${leadId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve_draft', message_id }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error ?? 'Could not send'); }
    load();
  };

  const card = 'border border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-surface)]';
  const mode = conv?.autonomy_mode ?? 'off';

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] font-semibold text-[var(--c-text)] flex items-center gap-1.5"><Bot size={15} className="text-[var(--c-gold-deep)]" /> Autonomy for this lead</div>
          <div className="inline-flex rounded-btn border border-[var(--c-border)] overflow-hidden">
            {['off', 'suggest', 'autonomous'].map((m) => (
              <button key={m} disabled={busy} onClick={() => setMode(m)} className={`px-3 h-8 text-[12px] capitalize ${mode === m ? 'bg-[var(--c-text)] text-[var(--c-surface)]' : 'text-[var(--c-label2)] hover:bg-[var(--c-fill)]'}`}>{m}</button>
            ))}
          </div>
        </div>
        {conv?.status === 'escalated' && (
          <div className="mt-3 flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Handed to you{conv.escalation_reason ? `: ${conv.escalation_reason}` : '.'} Set a mode above to resume Ashley.
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : msgs.length === 0 ? (
        <div className="text-[13px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[12px] px-4 py-6 text-center">No conversation yet. When this borrower texts in, Ashley will {mode === 'off' ? 'stay off' : mode === 'suggest' ? 'draft a reply for you' : 'reply automatically'}.</div>
      ) : (
        <div className={`${card} space-y-2.5`}>
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'borrower' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-[12px] px-3 py-2 text-[13px] ${m.role === 'borrower' ? 'bg-[var(--c-fill)] text-[var(--c-text)]' : m.gated ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-[var(--c-text)] text-[var(--c-surface)]'}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-80">
                  {m.role !== 'borrower' && (m.sent ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={10} /> sent</span> : <span>draft</span>)}
                  {m.gated && <span className="inline-flex items-center gap-1"><AlertTriangle size={10} /> blocked</span>}
                  {m.tool_trace?.length ? <span>· {m.tool_trace.map((t) => t.name).join(', ')}</span> : null}
                </div>
                {m.role === 'assistant' && !m.sent && !m.gated && (
                  <button disabled={busy} onClick={() => approve(m.id)} className="mt-2 inline-flex items-center gap-1 h-7 px-2.5 rounded-btn bg-[var(--c-surface)] text-[var(--c-text)] text-[11px] font-medium border border-[var(--c-border)] hover:bg-[var(--c-fill)]"><Send size={11} /> Approve & send</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Simulator leadId={leadId} />
    </div>
  );
}

function Simulator({ leadId }: { leadId: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ reply: string | null; escalated: boolean; escalationReason?: string; toolTrace: { name: string }[] } | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true); setOut(null);
    const j = await fetch('/api/concierge/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, message: text }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    setOut(j.result ?? { reply: j.error ?? 'Error', escalated: false, toolTrace: [] });
  };

  return (
    <div className="border border-dashed border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-fill)]">
      <div className="text-[13px] font-semibold text-[var(--c-text)] flex items-center gap-1.5 mb-2"><FlaskConical size={15} className="text-[var(--c-gold-deep)]" /> Test a reply <span className="text-[11px] font-normal text-[var(--c-label2)]">(dry run — nothing is sent)</span></div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder='e.g. "Hi, what rate can I get on a 30 year?"' className="flex-1 h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]" />
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Test</button>
      </div>
      {out && (
        <div className="mt-3 text-[13px]">
          <div className="rounded-[12px] bg-[var(--c-surface)] border border-[var(--c-border)] px-3 py-2 text-[var(--c-text)] whitespace-pre-wrap">{out.reply}</div>
          <div className="mt-1.5 text-[11px] text-[var(--c-label2)] flex items-center gap-2 flex-wrap">
            {out.escalated && <span className="text-amber-600 inline-flex items-center gap-1"><AlertTriangle size={11} /> would escalate{out.escalationReason ? `: ${out.escalationReason}` : ''}</span>}
            {out.toolTrace?.length ? <span>tools: {out.toolTrace.map((t) => t.name).join(', ')}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
