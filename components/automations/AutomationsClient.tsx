'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconPlus, IconRobot } from '@tabler/icons-react';
import { RuleList } from './RuleList';
import { RuleBuilderModal } from './RuleBuilderModal';
import { PendingApprovalsPanel } from './PendingApprovalsPanel';
import { AutomationLogTable } from './AutomationLogTable';
import type { MilestoneAutomationRule } from '@/types/automation';

type Tab = 'rules' | 'queue' | 'history';

export function AutomationsClient() {
  const [rules, setRules] = useState<MilestoneAutomationRule[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<MilestoneAutomationRule | null>(null);
  const [tab, setTab] = useState<Tab>('rules');

  const loadRules = useCallback(async () => {
    const res = await fetch('/api/automations/rules');
    const data = await res.json();
    setRules(data.rules ?? []);
  }, []);

  useEffect(() => {
    loadRules();
    if (typeof window !== 'undefined' && window.location.hash.includes('queue')) setTab('queue');
  }, [loadRules]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/10 flex items-center justify-center">
            <IconRobot size={18} className="text-[#C9A95C]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Milestone Automations</h1>
            <p className="text-sm text-gray-400 mt-0.5">Auto-send messages when loans reach key stages</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setShowBuilder(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A95C] text-white rounded-xl text-sm font-medium hover:brightness-95 transition-colors"
        >
          <IconPlus size={15} />
          Add Rule
        </button>
      </div>

      <div className="flex gap-1 mt-4 border-b border-gray-100">
        {(['rules', 'queue', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-[#C9A95C] text-[#C9A95C]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'rules' && (
          <RuleList
            rules={rules}
            onAdd={() => {
              setEditingRule(null);
              setShowBuilder(true);
            }}
            onEdit={(rule) => {
              setEditingRule(rule);
              setShowBuilder(true);
            }}
            onRefresh={loadRules}
          />
        )}
        {tab === 'queue' && <PendingApprovalsPanel />}
        {tab === 'history' && <AutomationLogTable />}
      </div>

      {showBuilder && (
        <RuleBuilderModal
          rule={editingRule}
          onClose={() => setShowBuilder(false)}
          onSaved={() => {
            setShowBuilder(false);
            loadRules();
          }}
        />
      )}
    </div>
  );
}
