'use client';

/**
 * Phase 127 — a single Ashley Brain™ memory. Optionally supports inline
 * "correction" (supersede), which never edits in place — it creates a new
 * memory and retires this one.
 */
import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { MEMORY_SOURCE_LABELS, type BrainMemory } from '@/lib/brain/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`;
  return `${Math.floor(diff / (365 * day))}y ago`;
}

interface Props {
  memory?: BrainMemory;
  text?: string;
  source?: string;
  onSupersede?: (oldId: string, newText: string) => Promise<void> | void;
}

export function BrainMemoryCard({ memory, text, source, onSupersede }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory?.memory_text ?? '');
  const [saving, setSaving] = useState(false);

  const body = memory?.memory_text ?? text ?? '';
  const src = memory?.source ?? source;

  async function save() {
    if (!memory || !onSupersede) return;
    const next = draft.trim();
    if (!next || next === memory.memory_text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSupersede(memory.id, next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group bg-white rounded-[8px] border border-black/[0.05] px-3.5 py-2.5">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full text-sm text-label resize-none outline-none border border-black/10 rounded-[6px] px-2 py-1.5 focus:border-navy/50"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-navy rounded-[6px] px-2.5 py-1 hover:bg-navy/90 disabled:opacity-60"
            >
              <Check size={12} /> Update
            </button>
            <button
              onClick={() => {
                setDraft(memory?.memory_text ?? '');
                setEditing(false);
              }}
              className="flex items-center gap-1 text-xs text-label-3 hover:text-label-2"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-label leading-snug">{body}</p>
            {src && (
              <p className="text-[11px] text-label-3 mt-1">
                via {MEMORY_SOURCE_LABELS[src] ?? src}
                {memory ? ` · ${timeAgo(memory.extracted_at)}` : ''}
              </p>
            )}
          </div>
          {memory && onSupersede && (
            <button
              onClick={() => {
                setDraft(memory.memory_text);
                setEditing(true);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-label-3 hover:text-navy"
              title="Correct this memory"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
