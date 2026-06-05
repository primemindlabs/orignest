'use client';

import { useState } from 'react';
import {
  Zap, Plus, Power, Pencil, Trash2, Clock, ChevronRight,
  Mail, MessageSquare, CheckSquare, UserCheck, ArrowRight,
  Megaphone, Bell, Bot, Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TriggerType =
  | 'new_lead' | 'stage_changed' | 'no_contact_hours' | 'trid_deadline_approaching'
  | 'rate_drop' | 'document_overdue' | 'anniversary' | 'birthday'
  | 'rate_lock_expiring' | 'lead_score_changed' | 'application_submitted'
  | 'closing_date_approaching';

type ActionType =
  | 'send_sms' | 'send_email' | 'create_task' | 'assign_lead' | 'change_stage'
  | 'enroll_campaign' | 'notify_lo' | 'notify_manager' | 'ai_analysis' | 'webhook';

interface Automation {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggerType: TriggerType;
  actionType: ActionType;
  runCount: number;
  lastRunAt?: string;
  triggerConfig: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_lead: 'New lead arrives',
  stage_changed: 'Stage changes to...',
  no_contact_hours: 'No contact for X hours',
  trid_deadline_approaching: 'TRID deadline in X days',
  rate_drop: 'Rate drops X%',
  document_overdue: 'Document overdue',
  anniversary: 'Closing anniversary',
  birthday: 'Borrower birthday',
  rate_lock_expiring: 'Rate lock expiring in X days',
  lead_score_changed: 'AI score changes',
  application_submitted: 'Application submitted',
  closing_date_approaching: 'Closing in X days',
};

const ACTION_LABELS: Record<ActionType, string> = {
  send_sms: 'Send SMS',
  send_email: 'Send Email',
  create_task: 'Create Task',
  assign_lead: 'Assign Lead',
  change_stage: 'Change Stage',
  enroll_campaign: 'Enroll in Campaign',
  notify_lo: 'Notify LO',
  notify_manager: 'Notify Manager',
  ai_analysis: 'Run AI Analysis',
  webhook: 'Send Webhook',
};

const TRIGGER_ICONS: Record<TriggerType, React.ElementType> = {
  new_lead: Zap,
  stage_changed: ArrowRight,
  no_contact_hours: Clock,
  trid_deadline_approaching: Clock,
  rate_drop: ChevronRight,
  document_overdue: CheckSquare,
  anniversary: Bell,
  birthday: Bell,
  rate_lock_expiring: Clock,
  lead_score_changed: Bot,
  application_submitted: CheckSquare,
  closing_date_approaching: Clock,
};

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  send_sms: MessageSquare,
  send_email: Mail,
  create_task: CheckSquare,
  assign_lead: UserCheck,
  change_stage: ArrowRight,
  enroll_campaign: Megaphone,
  notify_lo: Bell,
  notify_manager: Bell,
  ai_analysis: Bot,
  webhook: Webhook,
};

const SYSTEM_AGENTS = [
  { key: 'morning_briefing', label: 'Morning Briefing', desc: 'Runs daily at 7am. Sends personalized pipeline summary to each LO.', schedule: 'Daily 7am' },
  { key: 'speed_to_contact', label: 'Speed-to-Contact', desc: 'Runs every 5 min. Escalates new leads with no contact.', schedule: 'Every 5 min' },
  { key: 'rate_watch', label: 'Rate Watch', desc: 'Runs hourly. Detects refi opportunities for closed loans.', schedule: 'Hourly' },
  { key: 'trid_monitor', label: 'TRID Compliance Monitor', desc: 'Runs daily at 6am. Alerts on LE and CD deadlines.', schedule: 'Daily 6am' },
  { key: 'document_chase', label: 'Document Chase', desc: 'Runs daily at 9am. Sends reminders for overdue documents.', schedule: 'Daily 9am' },
];

// Mock data for demo
const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: '1',
    name: 'Welcome new lead',
    description: 'Send a warm welcome email when a new lead arrives',
    active: true,
    triggerType: 'new_lead',
    actionType: 'send_email',
    runCount: 247,
    lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    triggerConfig: {},
    actionConfig: { subject: 'Welcome! Let\'s get your mortgage started.' },
  },
  {
    id: '2',
    name: 'No contact 24hr alert',
    description: 'Create task if lead not contacted after 24 hours',
    active: true,
    triggerType: 'no_contact_hours',
    actionType: 'create_task',
    runCount: 89,
    lastRunAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    triggerConfig: { hours: 24 },
    actionConfig: { task_title: 'Follow up — no contact in 24 hours', priority: 'high' },
  },
  {
    id: '3',
    name: 'Rate lock expiring',
    description: 'Notify LO when rate lock expires in 3 days',
    active: false,
    triggerType: 'rate_lock_expiring',
    actionType: 'notify_lo',
    runCount: 14,
    lastRunAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    triggerConfig: { days: 3 },
    actionConfig: { message: 'URGENT: Rate lock expiring in 3 days!' },
  },
];

function AutomationCard({ auto, onToggle }: { auto: Automation; onToggle: (id: string) => void }) {
  const TriggerIcon = TRIGGER_ICONS[auto.triggerType];
  const ActionIcon = ACTION_ICONS[auto.actionType];

  return (
    <div className={cn('bg-surface rounded-[10px] border p-4 shadow-card transition-opacity', auto.active ? 'border-black/[0.06]' : 'border-black/[0.04] opacity-60')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-label truncate">{auto.name}</h3>
            {auto.active && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-green/10 text-green text-[10px] font-semibold">Active</span>
            )}
          </div>
          {auto.description && (
            <p className="text-xs text-label-2">{auto.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onToggle(auto.id)}
            className={cn(
              'w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors',
              auto.active
                ? 'bg-green/10 text-green hover:bg-green/20'
                : 'bg-black/[0.06] text-label-3 hover:bg-black/[0.10]',
            )}
          >
            <Power size={14} />
          </button>
          <button className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-black/[0.06] text-label-2 hover:bg-black/[0.10] transition-colors">
            <Pencil size={14} />
          </button>
          <button className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-black/[0.06] text-red/80 hover:bg-red/10 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Trigger → Action */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-blue/10 text-blue text-xs font-medium">
          <TriggerIcon size={12} />
          <span>{TRIGGER_LABELS[auto.triggerType]}</span>
        </div>
        <ChevronRight size={14} className="text-label-3 flex-shrink-0" />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-gold/15 text-amber-700 text-xs font-medium">
          <ActionIcon size={12} />
          <span>{ACTION_LABELS[auto.actionType]}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-label-3">
        <span>Run {auto.runCount.toLocaleString()} times</span>
        {auto.lastRunAt && (
          <>
            <span>·</span>
            <span>Last: {new Date(auto.lastRunAt).toLocaleDateString()}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(MOCK_AUTOMATIONS);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState<TriggerType>('new_lead');
  const [newAction, setNewAction] = useState<ActionType>('send_email');
  const [systemToggles, setSystemToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(SYSTEM_AGENTS.map((a) => [a.key, true])),
  );

  function toggleAutomation(id: string) {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  }

  function toggleSystem(key: string) {
    setSystemToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    if (!newName.trim()) return;
    const newAuto: Automation = {
      id: crypto.randomUUID(),
      name: newName,
      active: true,
      triggerType: newTrigger,
      actionType: newAction,
      runCount: 0,
      triggerConfig: {},
      actionConfig: {},
    };
    setAutomations((prev) => [newAuto, ...prev]);
    setShowForm(false);
    setNewName('');
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-label tracking-tight">Automations</h1>
          <p className="text-sm text-label-2 mt-0.5">Rules that run automatically when conditions are met</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-[12px] hover:bg-navy/90 transition-colors"
        >
          <Plus size={16} />
          New Automation
        </button>
      </div>

      {/* New Automation Form */}
      {showForm && (
        <div className="bg-surface rounded-[10px] border border-blue/30 p-5 shadow-card animate-fade-in">
          <h2 className="text-sm font-semibold text-label mb-4">New Automation Rule</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Rule Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Welcome new lead"
                className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Trigger (When)</label>
                <select
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value as TriggerType)}
                  className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
                >
                  {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                    <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Action (Do)</label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value as ActionType)}
                  className="w-full px-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
                >
                  {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
                    <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue text-white text-sm font-semibold rounded-[12px] hover:bg-blue/90 transition-colors"
              >
                Save Automation
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-black/[0.06] text-label-2 text-sm font-medium rounded-[12px] hover:bg-black/[0.10] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Custom Automation Rules */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-label-3 uppercase tracking-widest">Custom Rules ({automations.length})</h2>
          {automations.length === 0 ? (
            <div className="bg-surface rounded-[10px] border border-black/[0.06] p-8 text-center">
              <Zap size={24} className="mx-auto text-label-3 mb-2" />
              <p className="text-sm text-label-2">No custom automations yet.</p>
              <p className="text-xs text-label-3 mt-1">Create your first rule above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((auto) => (
                <AutomationCard key={auto.id} auto={auto} onToggle={toggleAutomation} />
              ))}
            </div>
          )}
        </div>

        {/* Right: System Automations */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-label-3 uppercase tracking-widest">System AI Agents</h2>
          <div className="space-y-3">
            {SYSTEM_AGENTS.map((agent) => {
              const enabled = systemToggles[agent.key];
              return (
                <div
                  key={agent.key}
                  className={cn(
                    'bg-surface rounded-[10px] border p-4 shadow-card transition-opacity',
                    enabled ? 'border-black/[0.06]' : 'border-black/[0.04] opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn('w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0', enabled ? 'bg-navy/10' : 'bg-black/[0.06]')}>
                        <Bot size={15} className={enabled ? 'text-navy' : 'text-label-3'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-label">{agent.label}</h3>
                          <span className="text-[10px] font-medium text-label-3 bg-black/[0.06] px-1.5 py-0.5 rounded-full">{agent.schedule}</span>
                        </div>
                        <p className="text-xs text-label-2 leading-relaxed">{agent.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSystem(agent.key)}
                      className={cn(
                        'flex-shrink-0 w-10 h-6 rounded-full transition-colors relative',
                        enabled ? 'bg-green' : 'bg-black/[0.20]',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                          enabled ? 'translate-x-5' : 'translate-x-1',
                        )}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-label-3 px-1">System agents are managed by Orignest and cannot be edited. Toggle to disable for your organization.</p>
        </div>
      </div>
    </div>
  );
}
