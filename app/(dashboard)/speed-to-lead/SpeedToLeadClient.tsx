'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { IconPhone, IconMessage, IconCircleCheck, IconBolt } from '@tabler/icons-react';

interface Lead { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; created_at: string }

function waited(created: string): { label: string; urgent: boolean } {
  const mins = Math.floor((Date.now() - new Date(created).getTime()) / 60000);
  if (mins < 60) return { label: `${mins}m waiting`, urgent: mins >= 5 };
  if (mins < 1440) return { label: `${Math.floor(mins / 60)}h waiting`, urgent: true };
  return { label: `${Math.floor(mins / 1440)}d waiting`, urgent: true };
}

export function SpeedToLeadClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch('/api/leads/uncontacted');
    if (res.ok) { const j = await res.json(); setLeads(j.leads ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Re-render every 30s so the "waiting" timers stay live.
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  async function markContacted(id: string, channel: string) {
    await fetch(`/api/leads/${id}/contacted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }) });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  if (loading) return <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-[13px] text-[var(--c-label2)]">Loading your new leads…</div>;

  if (leads.length === 0) {
    return (
      <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-10 text-center">
        <IconCircleCheck size={36} className="text-[#3FB68B] mx-auto mb-3" />
        <p className="text-[15px] font-medium text-[var(--c-text)]">All caught up</p>
        <p className="text-[12.5px] text-[var(--c-label2)] mt-1">Every new lead has been contacted. New ones show up here the moment they arrive.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((l) => {
        const w = waited(l.created_at);
        return (
          <div key={l.id} className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/leads/${l.id}`} className="text-[14px] font-semibold text-[var(--c-text)] hover:text-[var(--c-gold-deep)] truncate">{l.first_name} {l.last_name}</Link>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${w.urgent ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}><IconBolt size={11} /> {w.label}</span>
              </div>
              <p className="text-[12px] text-[var(--c-label2)] truncate">{l.phone ?? l.email ?? 'No contact info'}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {l.phone && <a href={`tel:${l.phone}`} onClick={() => markContacted(l.id, 'call')} className="inline-flex items-center gap-1 rounded-[10px] bg-[#C9A95C] text-white px-3 py-2 text-[12px] font-medium hover:brightness-95"><IconPhone size={14} /> Call</a>}
              {l.phone && <a href={`sms:${l.phone}`} onClick={() => markContacted(l.id, 'sms')} className="inline-flex items-center gap-1 rounded-[10px] border border-[#C9A95C] text-[#8C6B2A] px-3 py-2 text-[12px] font-medium hover:bg-[var(--c-gold-light)]"><IconMessage size={14} /> Text</a>}
              <button onClick={() => markContacted(l.id, 'manual')} title="Mark contacted" className="inline-flex items-center rounded-[10px] border border-[var(--c-border)] px-2.5 py-2 text-[var(--c-label2)] hover:bg-[var(--c-fill)]"><IconCircleCheck size={15} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
