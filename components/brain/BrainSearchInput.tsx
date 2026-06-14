'use client';

/**
 * Phase 127 — semantic "Ask about this relationship" input.
 * Posts to /api/brain/query; bubbles results + searching state to the panel.
 */
import { useRef, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import type { BrainSearchResult, BrainEntityType } from '@/lib/brain/types';

interface Props {
  entityType: BrainEntityType;
  entityId: string;
  placeholder?: string;
  onResults: (results: BrainSearchResult[]) => void;
  onActiveChange: (active: boolean) => void;
}

export function BrainSearchInput({ entityType, entityId, placeholder, onResults, onActiveChange }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  async function run(q: string) {
    const query = q.trim();
    if (!query) {
      onActiveChange(false);
      onResults([]);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    onActiveChange(true);
    try {
      const res = await fetch('/api/brain/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, entityType, entityId }),
      });
      const json = await res.json();
      if (mySeq === seq.current) onResults(res.ok ? json.results ?? [] : []);
    } catch {
      if (mySeq === seq.current) onResults([]);
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }

  function clear() {
    setValue('');
    onActiveChange(false);
    onResults([]);
  }

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run(value);
          if (e.key === 'Escape') clear();
        }}
        placeholder={placeholder ?? 'Ask about this relationship…'}
        className="w-full h-9 pl-9 pr-9 rounded-[8px] border border-black/10 text-[13px] text-label outline-none focus:border-navy/50 transition-colors bg-white"
      />
      {(loading || value) && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 size={14} className="text-label-3 animate-spin" />
          ) : (
            <button onClick={clear} className="text-label-3 hover:text-label-2">
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
