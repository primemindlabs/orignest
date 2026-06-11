'use client';

// Phase 81 — count of undismissed urgent brief items, polled for the nav bell badge.

import { useEffect, useState } from 'react';

export function useUnreadBriefCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/morning-brief/unread-count');
        const d = (await r.json()) as { count?: number };
        if (alive) setCount(d.count ?? 0);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return count;
}
