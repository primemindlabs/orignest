'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconBolt, IconChecks } from '@tabler/icons-react';
import { AutopilotActionCard, type QueueAction } from './AutopilotActionCard';
import { UndoToast } from './UndoToast';

type UndoState = { actionId: string; deadline: Date; action: QueueAction };

/** Phase 128 — Ashley Autopilot™ morning queue, mounted at the top of the dashboard. */
export function AutopilotQueue() {
  const [actions, setActions] = useState<QueueAction[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/autopilot/queue');
      const d = await r.json();
      setLocked(!!d.locked);
      setActions((d.actions ?? []) as QueueAction[]);
    } catch {
      setActions([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (locked) return <AutopilotTeaser />;
  if (!actions || actions.length === 0) return null;

  const remove = (id: string) => setActions((a) => (a ?? []).filter((x) => x.id !== id));

  const handleApprove = async (action: QueueAction) => {
    const r = await fetch('/api/autopilot/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId: action.id }),
    });
    const d = await r.json();
    if (!r.ok) {
      toast.error(d.error ?? 'Could not approve');
      return;
    }
    remove(action.id);
    const sends = action.action_type === 'send_sms' || action.action_type === 'send_email';
    if (sends) {
      setUndo({ actionId: action.id, deadline: new Date(d.undoDeadline), action });
    } else {
      toast.success('Done.');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const r = await fetch('/api/autopilot/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId: id, reason }),
    });
    if (!r.ok) {
      const d = await r.json();
      toast.error(d.error ?? 'Could not skip');
      return;
    }
    remove(id);
  };

  const handleApproveAll = async () => {
    const r = await fetch('/api/autopilot/approve-all', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) {
      toast.error(d.error ?? 'Could not approve all');
      return;
    }
    setActions([]);
    toast.success(`Approved ${d.count} action${d.count === 1 ? '' : 's'} — sends go out shortly. Undo from each within 5 min.`);
  };

  const handleUndo = async () => {
    if (!undo) return;
    const captured = undo;
    setUndo(null);
    const r = await fetch('/api/autopilot/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId: captured.actionId }),
    });
    if (r.ok) {
      setActions((a) => [captured.action, ...(a ?? [])]);
      toast.success('Action undone.');
    } else {
      const d = await r.json();
      toast.error(d.error ?? 'Undo failed');
    }
  };

  const count = actions.length;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EDE8]">
        <div className="flex items-center gap-2">
          <IconBolt size={18} className="text-[#C9A95C]" />
          <h2 className="font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
            Ashley recommends {count} action{count !== 1 ? 's' : ''} today
          </h2>
        </div>
        <button
          onClick={handleApproveAll}
          className="flex items-center gap-1.5 bg-[#C9A95C] text-white text-sm px-4 py-2 rounded-lg hover:brightness-95 transition-colors"
        >
          <IconChecks size={14} />
          Approve all {count}
        </button>
      </div>

      <div className="divide-y divide-[#F0EDE8]">
        {actions.map((action) => (
          <AutopilotActionCard key={action.id} action={action} onApprove={handleApprove} onReject={handleReject} />
        ))}
      </div>

      {undo && <UndoToast deadline={undo.deadline} onUndo={handleUndo} onExpire={() => setUndo(null)} />}
    </div>
  );
}

function AutopilotTeaser() {
  return (
    <div className="bg-gradient-to-r from-[#FEFDF9] to-[#FFF8ED] rounded-2xl border border-[#C9A95C]/20 px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <IconBolt size={16} className="text-[#C9A95C]" />
            <h3 className="font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
              Ashley Autopilot™
            </h3>
            <span className="text-xs bg-[#C9A95C] text-white px-2 py-0.5 rounded-full">Pro</span>
          </div>
          <p className="text-sm text-[#6B7B8D]">
            Ashley surfaces the 5–8 highest-leverage actions every morning — each pre-drafted. One tap to execute.
          </p>
        </div>
        <a
          href="/settings/billing"
          className="bg-[#C9A95C] text-white text-sm px-5 py-2.5 rounded-lg flex-shrink-0 hover:brightness-95"
        >
          Upgrade to Pro
        </a>
      </div>
    </div>
  );
}
