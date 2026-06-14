'use client';

/**
 * Phase 127 — global Ashley Brain™ search (the /brain page + Cmd+K destination).
 * Searches across everything Ashley knows for this LO, with no entity filter.
 */
import { useState } from 'react';
import { Search, Loader2, Brain } from 'lucide-react';
import { BrainMemoryCard } from './BrainMemoryCard';
import type { BrainSearchResult } from '@/lib/brain/types';

export function BrainGlobalSearch() {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<BrainSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    const query = value.trim();
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch('/api/brain/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });
      const json = await res.json();
      setResults(res.ok ? (json.results ?? []) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-label-3" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="What do I know about… (a borrower, a preference, an objection)"
          className="w-full h-12 pl-11 pr-4 rounded-[10px] border border-black/10 text-[14px] text-label outline-none focus:border-navy/50 transition-colors bg-surface shadow-card"
          autoFocus
        />
        {loading && (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-label-3 animate-spin" />
        )}
      </div>

      {results === null ? (
        <div className="text-center py-16 text-label-3">
          <Brain size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Ask Ashley anything about your book of business.</p>
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-label-3 text-center py-12">Nothing matched. Try different words.</p>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <BrainMemoryCard
              key={`${r.content_type}-${r.content_id}`}
              text={r.content_text}
              source={r.content_type === 'memory' ? undefined : 'note'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
