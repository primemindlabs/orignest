'use client';

import { IconCheck, IconSparkles, IconPhonePlus, IconChevronDown } from '@tabler/icons-react';
import { getInitials, formatCurrencyShort, cn } from '@/lib/utils';
import { URGENCY_STYLE } from '@/lib/dialer/priority';
import type { QueueLead, PriorityLead } from '@/lib/dialer/types';

const GOLD = '#C9A95C';

const STAGE_LABEL: Record<string, string> = {
  new_inquiry: 'New inquiry',
  pre_qual: 'Pre-qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. approval',
};

interface Props {
  priority: PriorityLead[];
  rest: QueueLead[];
  selectedIds: Set<string>;
  calledIds: Set<string>;
  activeId: string | null;
  totalCount: number;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onSelect: (lead: QueueLead) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  filterOptions: { value: string; label: string }[];
  onDialNew: () => void;
}

export function DialerQueue({
  priority,
  rest,
  selectedIds,
  calledIds,
  activeId,
  totalCount,
  onToggleSelect,
  onSelectAll,
  onSelect,
  filter,
  onFilterChange,
  filterOptions,
  onDialNew,
}: Props) {
  const allSelected = totalCount > 0 && selectedIds.size === totalCount;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden flex flex-col">
      {/* Header: select-all + filter */}
      <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="accent-[#C9A95C]"
          />
          <span className="text-sm font-semibold text-label">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Call queue'}
          </span>
        </label>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="appearance-none text-xs font-medium text-label-2 bg-bg rounded-lg pl-2.5 pr-6 py-1.5 border border-black/[0.06] focus:outline-none"
          >
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-label-3 pointer-events-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[540px]">
        {/* AI priority pinned at top */}
        {priority.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
              <IconSparkles size={12} style={{ color: GOLD }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#876830' }}>
                AI priority
              </span>
            </div>
            {priority.map((lead) => (
              <QueueItem
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                called={calledIds.has(lead.id)}
                active={activeId === lead.id}
                onToggle={() => onToggleSelect(lead.id)}
                onSelect={() => onSelect(lead)}
              />
            ))}
            <div className="h-px bg-black/[0.06] mx-4 my-1" />
          </div>
        )}

        {priority.length === 0 && rest.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-label-3">No leads in the queue.</p>
        )}

        {rest.map((lead) => (
          <QueueItem
            key={lead.id}
            lead={lead}
            selected={selectedIds.has(lead.id)}
            called={calledIds.has(lead.id)}
            active={activeId === lead.id}
            onToggle={() => onToggleSelect(lead.id)}
            onSelect={() => onSelect(lead)}
          />
        ))}
      </div>

      <button
        onClick={onDialNew}
        className="border-t border-black/[0.06] px-4 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-bg transition-colors"
        style={{ color: '#876830' }}
      >
        <IconPhonePlus size={14} /> Dial new number
      </button>
    </div>
  );
}

function QueueItem({
  lead,
  selected,
  called,
  active,
  onToggle,
  onSelect,
}: {
  lead: QueueLead | PriorityLead;
  selected: boolean;
  called: boolean;
  active: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const priority = 'urgencyLabel' in lead ? (lead as PriorityLead) : null;
  const style = priority ? URGENCY_STYLE[priority.urgencyKind] : null;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors hover:bg-bg',
        called && 'opacity-50'
      )}
      style={active ? { background: '#fdf8ee', borderLeft: `2.5px solid ${GOLD}` } : undefined}
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="accent-[#C9A95C] flex-shrink-0"
      />
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
        style={priority ? { background: style!.bg, color: style!.fg } : { background: '#f0f0f2', color: '#6B7B8D' }}
      >
        {getInitials(`${lead.first_name} ${lead.last_name}`)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium text-label truncate', called && 'line-through')}>
          {lead.first_name} {lead.last_name}
        </p>
        {priority ? (
          <span
            className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
            style={{ background: style!.bg, color: style!.fg }}
          >
            {priority.urgencyLabel}
          </span>
        ) : (
          <p className="text-[11px] text-label-3 truncate">
            {lead.loan_amount ? formatCurrencyShort(lead.loan_amount) : '—'} · {STAGE_LABEL[lead.stage] ?? lead.stage}
          </p>
        )}
      </div>
      {called && <IconCheck size={14} className="text-label-3 flex-shrink-0" />}
    </div>
  );
}
