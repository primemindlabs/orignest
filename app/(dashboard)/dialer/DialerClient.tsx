'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconPhone } from '@tabler/icons-react';
import { cn, formatPhone } from '@/lib/utils';
import { partitionQueue } from '@/lib/dialer/priority';
import { loadSession, saveSession, clearSession } from '@/lib/dialer/session';
import type { QueueLead } from '@/lib/dialer/types';
import { DialerQueue } from '@/components/dialer/DialerQueue';
import { ActiveLeadPanel } from '@/components/dialer/ActiveLeadPanel';
import { TranscriptionsTab } from '@/components/dialer/TranscriptionsTab';
import { Dialpad } from '@/components/dialer/Dialpad';

type Tab = 'session' | 'transcriptions' | 'dialpad';

const TABS: { id: Tab; label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'transcriptions', label: 'Transcriptions' },
  { id: 'dialpad', label: 'Dialpad' },
];

export default function DialerClient() {
  const [tab, setTab] = useState<Tab>('session');
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [hydrated, setHydrated] = useState(false);

  // Load queue, then restore session progress (called/selected/active) from sessionStorage.
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/dialer/queue');
      let loaded: QueueLead[] = [];
      if (res.ok) {
        const j = (await res.json()) as { leads: QueueLead[]; twilioNumber: string | null };
        loaded = j.leads ?? [];
        setTwilioNumber(j.twilioNumber);
      }
      setLeads(loaded);

      const prior = loadSession();
      if (prior) {
        const present = new Set(loaded.map((l) => l.id));
        setCalledIds(new Set(prior.calledIds.filter((id) => present.has(id))));
        setSelectedIds(new Set(prior.selectedIds.filter((id) => present.has(id))));
        if (prior.currentIdx >= 0 && loaded[prior.currentIdx]) setActiveId(loaded[prior.currentIdx].id);
      }
      setHydrated(true);
    })();
  }, []);

  // Persist progress on every meaningful change.
  useEffect(() => {
    if (!hydrated) return;
    saveSession({
      queueIds: leads.map((l) => l.id),
      selectedIds: [...selectedIds],
      calledIds: [...calledIds],
      currentIdx: activeId ? leads.findIndex((l) => l.id === activeId) : -1,
      startedAt: loadSession()?.startedAt ?? new Date().toISOString(),
      callCount: calledIds.size,
      connectedCount: 0,
    });
  }, [hydrated, leads, selectedIds, calledIds, activeId]);

  const { priority, rest } = useMemo(() => {
    const filtered = filter === 'all' ? leads : leads.filter((l) => l.stage === filter);
    return partitionQueue(filtered);
  }, [leads, filter]);

  const orderedIds = useMemo(() => [...priority.map((l) => l.id), ...rest.map((l) => l.id)], [priority, rest]);
  const activeLead = useMemo(() => leads.find((l) => l.id === activeId) ?? null, [leads, activeId]);

  const filterOptions = useMemo(() => {
    const stages = Array.from(new Set(leads.map((l) => l.stage)));
    const LABELS: Record<string, string> = {
      new_inquiry: 'New inquiry',
      pre_qual: 'Pre-qual',
      application: 'Application',
      processing: 'Processing',
      underwriting: 'Underwriting',
      conditional_approval: 'Cond. approval',
    };
    return [{ value: 'all', label: 'All stages' }, ...stages.map((s) => ({ value: s, label: LABELS[s] ?? s }))];
  }, [leads]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set([...priority, ...rest].map((l) => l.id)) : new Set());
    },
    [priority, rest]
  );

  const goNext = useCallback(() => {
    if (!activeId) return;
    const idx = orderedIds.indexOf(activeId);
    const nextId = orderedIds.slice(idx + 1).find((id) => !calledIds.has(id));
    setActiveId(nextId ?? null);
  }, [activeId, orderedIds, calledIds]);

  const onCalled = useCallback((leadId: string) => {
    setCalledIds((prev) => new Set(prev).add(leadId));
  }, []);

  const totalInView = priority.length + rest.length;

  return (
    <div className="space-y-4">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <IconPhone size={22} style={{ color: '#C9A95C' }} />
          <h1 className="text-[24px] font-bold text-label tracking-tight">Dialer</h1>
        </div>
        {twilioNumber && <span className="text-xs text-label-2">Line: {formatPhone(twilioNumber)}</span>}
      </div>

      {/* Page tabs */}
      <div className="flex items-center gap-1 border-b border-black/[0.07]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'text-label' : 'text-label-3 hover:text-label-2'
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute left-0 right-0 -bottom-px h-0.5" style={{ background: '#C9A95C' }} />}
          </button>
        ))}
        {tab === 'session' && (
          <span className="ml-auto text-xs text-label-3 pr-1">
            {calledIds.size}/{totalInView} called
            {calledIds.size > 0 && (
              <button
                onClick={() => {
                  setCalledIds(new Set());
                  setActiveId(null);
                  clearSession();
                }}
                className="ml-3 font-semibold hover:underline"
                style={{ color: '#876830' }}
              >
                End session
              </button>
            )}
          </span>
        )}
      </div>

      {tab === 'session' && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <DialerQueue
            priority={priority}
            rest={rest}
            selectedIds={selectedIds}
            calledIds={calledIds}
            activeId={activeId}
            totalCount={totalInView}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onSelect={(l) => setActiveId(l.id)}
            filter={filter}
            onFilterChange={setFilter}
            filterOptions={filterOptions}
            onDialNew={() => setTab('dialpad')}
          />
          <ActiveLeadPanel lead={activeLead} onNext={goNext} onSkip={goNext} onCalled={onCalled} />
        </div>
      )}

      {tab === 'transcriptions' && <TranscriptionsTab />}

      {tab === 'dialpad' && <Dialpad callerIdNumber={twilioNumber} />}
    </div>
  );
}
