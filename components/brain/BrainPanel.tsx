'use client';

/**
 * Phase 127 — Ashley Brain™ profile panel.
 * Structured memory cards (grouped by type) + semantic search + add + correct.
 * Drops into any borrower/realtor/partner/AE profile.
 */
import { useCallback, useEffect, useState } from 'react';
import { Brain, Plus, Loader2 } from 'lucide-react';
import { BrainMemoryCard } from './BrainMemoryCard';
import { BrainSearchInput } from './BrainSearchInput';
import { AddMemoryModal } from './AddMemoryModal';
import {
  BRAIN_MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  type BrainEntityType,
  type BrainMemory,
  type BrainSearchResult,
} from '@/lib/brain/types';

interface Props {
  entityType: BrainEntityType;
  entityId: string;
  entityName: string;
}

export function BrainPanel({ entityType, entityId, entityName }: Props) {
  const [memories, setMemories] = useState<BrainMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<BrainSearchResult[]>([]);
  const [searchActive, setSearchActive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brain/entity?entityType=${entityType}&entityId=${entityId}`);
      const json = await res.json();
      setMemories(res.ok ? (json.memories ?? []) : []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSupersede(oldId: string, newText: string) {
    const res = await fetch('/api/brain/supersede', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldMemoryId: oldId, newMemoryText: newText }),
    });
    if (res.ok) await load();
  }

  // Group active memories by type, in the canonical type order.
  const grouped = BRAIN_MEMORY_TYPES.map((type) => ({
    type,
    items: memories.filter((m) => m.memory_type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-navy/10 flex items-center justify-center">
            <Brain size={14} className="text-navy" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-label">Ashley Brain™</h3>
            <p className="text-[11px] text-label-3">
              {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-navy hover:bg-navy/5 rounded-[8px] px-2.5 py-1.5 transition-colors"
        >
          <Plus size={13} /> Add memory
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        <BrainSearchInput
          entityType={entityType}
          entityId={entityId}
          placeholder={`Ask about ${entityName}…`}
          onResults={setSearchResults}
          onActiveChange={setSearchActive}
        />

        {searchActive ? (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-label-3 text-center py-6">No matches in what Ashley knows yet.</p>
            ) : (
              searchResults.map((r) => (
                <BrainMemoryCard
                  key={`${r.content_type}-${r.content_id}`}
                  text={r.content_text}
                  source={r.content_type === 'memory' ? undefined : 'note'}
                />
              ))
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-label-3">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : memories.length === 0 ? (
          <p className="text-sm text-label-3 text-center py-10">
            No memories yet. Ashley will learn as you interact with {entityName}.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.type}>
                <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide mb-2">
                  {MEMORY_TYPE_LABELS[g.type]}
                </p>
                <div className="space-y-1.5">
                  {g.items.map((m) => (
                    <BrainMemoryCard key={m.id} memory={m} onSupersede={handleSupersede} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddMemoryModal
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          onClose={() => setShowAdd(false)}
          onSaved={(m) => setMemories((prev) => [m, ...prev])}
        />
      )}
    </div>
  );
}
