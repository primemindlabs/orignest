'use client';

/** Phase 34.5 — campaign detail: status toggle, steps timeline, enrollments, enroll. */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Mail, MessageSquare, CheckSquare, Play, Pause, Sparkles, UserPlus } from 'lucide-react';

interface Step { step_number: number; delay_days: number; delay_hours: number; channel: string; subject: string | null; body: string; ai_personalize: boolean }
interface Campaign { id: string; name: string; type: string; status: string; description: string | null; auto_enroll: boolean }
interface Lead { id: string; first_name: string; last_name: string; stage: string }

const CH_ICON: Record<string, typeof Mail> = { email: Mail, sms: MessageSquare, task: CheckSquare };

export function CampaignDetailClient({ id, candidates }: { id: string; candidates: Lead[] }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, sends: 0 });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaign-manager/${id}`);
    if (res.ok) { const d = await res.json(); setCampaign(d.campaign); setSteps(d.steps ?? []); setStats(d.stats ?? stats); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function toggle() {
    if (!campaign) return;
    setBusy(true);
    const next = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/campaign-manager/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      if (res.ok) setCampaign({ ...campaign, status: next });
    } finally { setBusy(false); }
  }

  async function enroll() {
    if (selected.size === 0) return;
    setEnrolling(true); setNote(null);
    try {
      const res = await fetch(`/api/campaign-manager/${id}/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_ids: [...selected] }) });
      const d = await res.json();
      if (res.ok) { setNote(`Enrolled ${d.enrolled} of ${d.requested} (duplicates skipped).`); setSelected(new Set()); await load(); }
    } finally { setEnrolling(false); }
  }

  if (!campaign) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${campaign.status === 'active' ? 'bg-[rgba(52,199,89,0.12)] text-green' : 'bg-[var(--c-fill)] text-[var(--c-label2)]'}`}>{campaign.status}</span>
          <span className="text-[11px] text-[var(--c-label2)]">{campaign.type.replace(/_/g, ' ')}{campaign.auto_enroll ? ' · auto-enroll' : ''}</span>
        </div>
        <Button onClick={toggle} disabled={busy}>
          {campaign.status === 'active' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Active', stats.active], ['Completed', stats.completed], ['Messages sent', stats.sends]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3"><p className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">{l}</p><p className="text-[20px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
        ))}
      </div>

      {/* Steps timeline */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Sequence ({steps.length} steps)</h2>
        <div className="space-y-2">
          {steps.map((s) => {
            const Icon = CH_ICON[s.channel] ?? Mail;
            return (
              <div key={s.step_number} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-[8px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-[var(--c-label2)]" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[var(--c-label2)]">Day {s.delay_days}</span>
                    <span className="text-[10px] uppercase text-[var(--c-label2)]">{s.channel}</span>
                    {s.ai_personalize && <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--c-gold-deep)]"><Sparkles size={10} /> AI</span>}
                  </div>
                  {s.subject && <p className="text-[13px] font-medium text-[var(--c-text)] mt-0.5">{s.subject}</p>}
                  <p className="text-[12px] text-[var(--c-label2)] mt-0.5 line-clamp-2">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enroll */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Enroll leads</h2>
        {note && <p className="text-[12px] text-green mb-2">{note}</p>}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--c-border)] flex items-center justify-between">
            <span className="text-[12px] text-[var(--c-label2)]">{selected.size} selected</span>
            <Button onClick={enroll} disabled={enrolling || selected.size === 0}><UserPlus size={13} /> {enrolling ? 'Enrolling…' : 'Enroll selected'}</Button>
          </div>
          <div className="max-h-[40vh] overflow-y-auto divide-y divide-[var(--c-border)]">
            {candidates.length === 0 && <p className="text-[13px] text-[var(--c-label2)] p-5 text-center">No active leads to enroll.</p>}
            {candidates.map((l) => (
              <label key={l.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-[var(--c-fill)]">
                <input type="checkbox" checked={selected.has(l.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(l.id) : n.delete(l.id); return n; })} className="accent-[var(--c-gold)]" />
                <span className="text-[13px] text-[var(--c-text)] flex-1">{l.first_name} {l.last_name}</span>
                <span className="text-[10px] uppercase text-[var(--c-label2)]">{l.stage.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
