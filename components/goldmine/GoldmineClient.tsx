'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconPick } from '@tabler/icons-react';
import { GoldmineOpportunityCard, type GoldmineOpp } from './GoldmineOpportunityCard';
import { GoldmineFilters, type SignalFilter } from './GoldmineFilters';
import { GoldmineWinsTab } from './GoldmineWinsTab';

export function GoldmineClient() {
  const [opps, setOpps] = useState<GoldmineOpp[] | null>(null);
  const [wins, setWins] = useState<GoldmineOpp[] | null>(null);
  const [tab, setTab] = useState<'opportunities' | 'wins'>('opportunities');
  const [filter, setFilter] = useState<SignalFilter>('all');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/goldmine/opportunities?status=surfaced');
      const d = await r.json();
      setOpps((d.opportunities ?? []) as GoldmineOpp[]);
    } catch {
      setOpps([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'wins' || wins !== null) return;
    fetch('/api/goldmine/opportunities?status=converted')
      .then((r) => r.json())
      .then((d) => setWins((d.opportunities ?? []) as GoldmineOpp[]))
      .catch(() => setWins([]));
  }, [tab, wins]);

  const remove = (id: string) => setOpps((o) => (o ?? []).filter((x) => x.id !== id));

  const handleSend = async (id: string, channel: 'sms' | 'email') => {
    const r = await fetch('/api/goldmine/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id, channel }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'Could not send'); return; }
    remove(id);
    toast.success(channel === 'sms' ? 'Text sent.' : 'Email sent.');
  };

  const handleDismiss = async (id: string) => {
    const r = await fetch('/api/goldmine/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    });
    if (!r.ok) { const d = await r.json(); toast.error(d.error ?? 'Could not dismiss'); return; }
    remove(id);
    toast.success('Dismissed for 90 days.');
  };

  const counts: Record<string, number> = {};
  for (const o of opps ?? []) counts[o.signal_type] = (counts[o.signal_type] ?? 0) + 1;
  const visible = (opps ?? []).filter((o) => filter === 'all' || o.signal_type === filter);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2 border-b border-[#E8E4DE]">
        {(['opportunities', 'wins'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-1 pb-2 -mb-px border-b-2 ${tab === t ? 'border-[#C9A95C] text-[#1A1A1A] font-medium' : 'border-transparent text-[#6B7B8D]'}`}
          >
            {t === 'opportunities' ? 'Opportunities' : 'Wins'}
          </button>
        ))}
      </div>

      {tab === 'opportunities' ? (
        <>
          <GoldmineFilters value={filter} onChange={setFilter} counts={counts} />
          {opps === null && <div className="text-sm text-[#6B7B8D] px-1 py-6">Loading your goldmine…</div>}
          {opps !== null && visible.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E8E4DE] px-5 py-10 text-center">
              <IconPick size={22} className="text-[#C9A95C] mx-auto mb-2" />
              <p className="text-sm text-[#6B7B8D]">No opportunities here right now. Ashley re-scans your book every week.</p>
            </div>
          )}
          <div className="space-y-2.5">
            {visible.map((o) => (
              <GoldmineOpportunityCard key={o.id} opp={o} onSend={handleSend} onDismiss={handleDismiss} />
            ))}
          </div>
        </>
      ) : (
        wins === null ? <div className="text-sm text-[#6B7B8D] px-1 py-6">Loading…</div> : <GoldmineWinsTab wins={wins} />
      )}
    </div>
  );
}
