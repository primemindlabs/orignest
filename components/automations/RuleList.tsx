'use client';

import { useState } from 'react';
import { IconRobot } from '@tabler/icons-react';
import { RuleCard } from './RuleCard';
import type { MilestoneAutomationRule } from '@/types/automation';

interface Props {
  rules: MilestoneAutomationRule[];
  onAdd: () => void;
  onEdit: (rule: MilestoneAutomationRule) => void;
  onRefresh: () => void;
}

export function RuleList({ rules, onAdd, onEdit, onRefresh }: Props) {
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    await fetch('/api/automations/rules/seed', { method: 'POST' });
    await onRefresh();
    setSeeding(false);
  }

  if (rules.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
        <IconRobot size={40} className="mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 font-medium">No automation rules yet</p>
        <p className="text-sm text-gray-400 mt-1">Create rules to auto-message borrowers and realtors</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-[#C9A95C] text-white rounded-xl text-sm font-medium hover:brightness-95 transition-colors"
          >
            Add your first rule
          </button>
          <button
            onClick={seed}
            disabled={seeding}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {seeding ? 'Adding…' : 'Load starter rules'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onEdit={() => onEdit(rule)} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
