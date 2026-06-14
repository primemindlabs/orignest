'use client';

/**
 * Phase 127 — manual "Add memory" modal (source = lo_input).
 */
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  BRAIN_MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  type BrainEntityType,
  type BrainMemory,
  type BrainMemoryType,
} from '@/lib/brain/types';

interface Props {
  entityType: BrainEntityType;
  entityId: string;
  entityName: string;
  onClose: () => void;
  onSaved: (memory: BrainMemory) => void;
}

export function AddMemoryModal({ entityType, entityId, entityName, onClose, onSaved }: Props) {
  const [memoryType, setMemoryType] = useState<BrainMemoryType>('relationship_fact');
  const [memoryText, setMemoryText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const text = memoryText.trim();
    if (!text) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/brain/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, memoryType, memoryText: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not save memory.');
        return;
      }
      onSaved(json.memory as BrainMemory);
      onClose();
    } catch {
      setError('Could not save memory.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-[12px] shadow-card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <h3 className="text-sm font-semibold text-label">Remember about {entityName}</h3>
          <button onClick={onClose} className="text-label-3 hover:text-label-2">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-label-2 uppercase tracking-wide">Type</label>
            <select
              value={memoryType}
              onChange={(e) => setMemoryType(e.target.value as BrainMemoryType)}
              className="mt-1 w-full h-9 px-2.5 rounded-[8px] border border-black/10 text-[13px] text-label bg-white outline-none focus:border-navy/50"
            >
              {BRAIN_MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEMORY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-label-2 uppercase tracking-wide">Memory</label>
            <textarea
              value={memoryText}
              onChange={(e) => setMemoryText(e.target.value)}
              rows={3}
              placeholder="e.g. Prefers FHA. Wants the payment under $2,500/mo."
              className="mt-1 w-full text-[13px] text-label resize-none outline-none border border-black/10 rounded-[8px] px-2.5 py-2 focus:border-navy/50"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red/10 border border-red/20 text-red text-xs px-3 py-2 rounded-[8px]">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-black/[0.06]">
          <button onClick={onClose} className="text-xs text-label-2 px-3 py-1.5 hover:text-label">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !memoryText.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-navy rounded-[8px] px-3.5 py-1.5 hover:bg-navy/90 disabled:opacity-60"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Save memory
          </button>
        </div>
      </div>
    </div>
  );
}
