'use client';

import { useState } from 'react';
import {
  IconMessage,
  IconMail,
  IconNote,
  IconLock,
  IconToggleLeft,
  IconToggleRight,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { STAGE_LABELS, type MilestoneAutomationRule, type AutomationActionType } from '@/types/automation';

const ACTION_CONFIG: Record<AutomationActionType, { icon: typeof IconMessage; label: string; color: string }> = {
  sms_borrower: { icon: IconMessage, label: 'SMS → Borrower', color: 'text-blue-500' },
  sms_realtor: { icon: IconMessage, label: 'SMS → Realtor', color: 'text-indigo-500' },
  email_borrower: { icon: IconMail, label: 'Email → Borrower', color: 'text-green-500' },
  email_realtor: { icon: IconMail, label: 'Email → Realtor', color: 'text-teal-500' },
  internal_note: { icon: IconNote, label: 'Internal Note', color: 'text-gray-400' },
};

interface Props {
  rule: MilestoneAutomationRule;
  onEdit: () => void;
  onRefresh: () => void;
}

export function RuleCard({ rule, onEdit, onRefresh }: Props) {
  const [active, setActive] = useState(rule.active);
  const [deleting, setDeleting] = useState(false);
  const cfg = ACTION_CONFIG[rule.action_type] ?? ACTION_CONFIG.internal_note;
  const Icon = cfg.icon;
  const isSms = rule.action_type.includes('sms');

  async function toggleActive() {
    const next = !active;
    setActive(next);
    await fetch(`/api/automations/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    });
    onRefresh();
  }

  async function handleDelete() {
    if (!confirm(`Deactivate "${rule.rule_name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/automations/rules/${rule.id}`, { method: 'DELETE' });
    onRefresh();
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-opacity ${active ? 'border-gray-100' : 'border-gray-50 opacity-55'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-xl bg-gray-50 flex-shrink-0 flex items-center justify-center ${cfg.color}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">{rule.rule_name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                When: {STAGE_LABELS[rule.trigger_stage] ?? rule.trigger_stage}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-50 ${cfg.color}`}>{cfg.label}</span>
              {rule.delay_minutes > 0 && (
                <span className="text-xs text-gray-400">
                  +{rule.delay_minutes < 60 ? `${rule.delay_minutes}m` : `${Math.round(rule.delay_minutes / 60)}h`} delay
                </span>
              )}
              {isSms && (
                <span className="flex items-center gap-0.5 text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">
                  <IconLock size={10} />
                  Requires approval
                </span>
              )}
              {!isSms && rule.requires_approval && (
                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">Requires approval</span>
              )}
              {!isSms && !rule.requires_approval && rule.auto_send_email && (
                <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">Auto-send</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <IconPencil size={15} />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50">
            <IconTrash size={15} />
          </button>
          <button onClick={toggleActive} aria-label="Toggle active" className={active ? 'text-[#C9A95C]' : 'text-gray-300'}>
            {active ? <IconToggleRight size={28} /> : <IconToggleLeft size={28} />}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 font-mono leading-relaxed line-clamp-2">
        {rule.message_template}
      </p>
    </div>
  );
}
