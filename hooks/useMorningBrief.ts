'use client';

// Phase 81 — fetch today's morning brief + dismiss items.
// Plain fetch + state (no SWR dependency). Refetches every 5 minutes so afternoon
// pipeline changes can surface on a fresh generation.

import { useCallback, useEffect, useState } from 'react';
import type { MorningBrief } from '@/lib/morning-brief/types';

export function useMorningBrief() {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/morning-brief');
      const d = (await r.json()) as MorningBrief;
      setBrief(d);
    } catch {
      // keep last good state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const dismiss = useCallback(async (itemId: string) => {
    // optimistic
    setBrief((b) =>
      b ? { ...b, dismissed_items: Array.from(new Set([...b.dismissed_items, itemId])) } : b,
    );
    try {
      await fetch('/api/morning-brief/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
    } catch {
      load(); // reconcile on failure
    }
  }, [load]);

  return { brief, dismiss, isLoading, reload: load };
}
