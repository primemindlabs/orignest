'use client';

import { useState, useEffect } from 'react';
import { IconX, IconLock, IconAlertCircle, IconEye } from '@tabler/icons-react';
import { ALLOWED_TEMPLATE_VARIABLES } from '@/lib/automations/template';
import { FUNNEL_STAGES, type MilestoneAutomationRule } from '@/types/automation';

const ACTION_TYPES = [
  { value: 'sms_borrower', label: 'SMS → Borrower' },
  { value: 'sms_realtor', label: 'SMS → Realtor' },
  { value: 'email_borrower', label: 'Email → Borrower' },
  { value: 'email_realtor', label: 'Email → Realtor' },
  { value: 'internal_note', label: 'Internal Note' },
];

const PREVIEW: Record<string, string> = {
  '{{borrower_first_name}}': 'Jamie',
  '{{loan_type}}': 'Conventional',
  '{{portal_link}}': 'app.ashleyiq.com/b/abc123',
  '{{realtor_name}}': 'Sarah Chen',
  '{{lo_name}}': 'Alex Rivera',
  '{{lo_phone}}': '(555) 867-5309',
  '{{lo_nmls}}': '1234567',
  '{{current_stage}}': 'Conditional Approval',
  '{{days_in_stage}}': '3',
};

function renderPreview(template: string): string {
  let out = template;
  for (const [v, val] of Object.entries(PREVIEW)) {
    out = out.split(v).join(val);
  }
  return out;
}

interface Props {
  rule: MilestoneAutomationRule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RuleBuilderModal({ rule, onClose, onSaved }: Props) {
  const [ruleName, setRuleName] = useState(rule?.rule_name ?? '');
  const [triggerStage, setTriggerStage] = useState(rule?.trigger_stage ?? '');
  const [actionType, setActionType] = useState<string>(rule?.action_type ?? 'sms_borrower');
  const [template, setTemplate] = useState(rule?.message_template ?? '');
  const [requiresApproval, setRequiresApproval] = useState(rule?.requires_approval ?? true);
  const [autoSendEmail, setAutoSendEmail] = useState(rule?.auto_send_email ?? false);
  const [delayMinutes, setDelayMinutes] = useState(rule?.delay_minutes ?? 0);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isSms = actionType.includes('sms');
  useEffect(() => {
    if (isSms) {
      setRequiresApproval(true);
      setAutoSendEmail(false);
    }
  }, [isSms]);

  function insertVariable(v: string) {
    setTemplate((prev) => prev + v);
  }

  async function handleSave() {
    if (!ruleName || !triggerStage || !template) return;
    setSaving(true);
    const payload = {
      rule_name: ruleName,
      trigger_stage: triggerStage,
      action_type: actionType,
      message_template: template,
      requires_approval: isSms ? true : requiresApproval,
      auto_send_email: isSms ? false : autoSendEmail,
      delay_minutes: delayMinutes,
    };
    const url = rule ? `/api/automations/rules/${rule.id}` : '/api/automations/rules';
    const res = await fetch(url, {
      method: rule ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) onSaved();
    else alert((await res.json().catch(() => ({}))).error ?? 'Failed to save rule');
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900">{rule ? 'Edit Automation Rule' : 'New Automation Rule'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <IconX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Rule Name</label>
            <input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Clear to Close SMS"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Trigger Stage</label>
            <select
              value={triggerStage}
              onChange={(e) => setTriggerStage(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
            >
              <option value="">Select stage…</option>
              {FUNNEL_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Action Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActionType(t.value)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    actionType === t.value ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]' : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Message Template</label>
              <button type="button" onClick={() => setShowPreview((p) => !p)} className="flex items-center gap-1 text-xs text-[#C9A95C] hover:underline">
                <IconEye size={12} />
                {showPreview ? 'Hide preview' : 'Preview'}
              </button>
            </div>
            <textarea
              rows={5}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={isSms ? 'Hi {{borrower_first_name}}, … Reply STOP to opt out.' : 'Hi {{realtor_name}}, …'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 resize-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-2 mb-1.5">Click to insert variable:</p>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full hover:bg-[#C9A95C]/10 hover:text-[#C9A95C] font-mono transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
            {showPreview && template && (
              <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-1 font-medium">Preview (sample data):</p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{renderPreview(template)}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Delay after trigger (minutes)</label>
            <input
              type="number"
              min={0}
              max={10080}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
            />
            <p className="text-xs text-gray-400 mt-0.5">0 = queued immediately at trigger</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Approval Required?</label>
            {isSms ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                <IconLock size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">SMS always requires LO approval before sending (TCPA compliance). This cannot be changed.</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRequiresApproval(true);
                    setAutoSendEmail(false);
                  }}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    requiresApproval ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  Require approval
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequiresApproval(false);
                    setAutoSendEmail(true);
                  }}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    !requiresApproval ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  Auto-send
                </button>
              </div>
            )}
          </div>

          {!isSms && !requiresApproval && (
            <div className="flex gap-2 items-start p-3 bg-amber-50 rounded-xl">
              <IconAlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Email will auto-send immediately when the stage triggers. No approval step.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={!ruleName || !triggerStage || !template || saving}
            className="w-full py-3 rounded-xl bg-[#C9A95C] text-white font-semibold text-sm hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : rule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
