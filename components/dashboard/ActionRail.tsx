'use client';

/** Phase 39.4 — persistent "today's priorities" strip. Renders nothing when empty. */
import { useState, useEffect } from 'react';
import { Lock, Bell, Calendar, FileWarning } from 'lucide-react';

interface Item { id: string; type: string; label: string; href: string; urgency: 'high' | 'normal' }
const ICON: Record<string, typeof Bell> = { rate_lock: Lock, closing: Calendar, missing_doc: FileWarning, follow_up: Bell };

export function ActionRail() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/dashboard/action-rail').then((r) => (r.ok ? r.json() : null)).then((d) => { if (active && d) setItems(d.items ?? []); }).catch(() => undefined);
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-[var(--c-surface)] border-b border-[var(--c-border)] px-6 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] font-medium text-[var(--c-label2)] whitespace-nowrap mr-2 flex-shrink-0">Today&apos;s priorities</span>
        {items.map((it) => {
          const Icon = ICON[it.type] ?? Bell;
          const urgent = it.urgency === 'high';
          return (
            <a key={it.id} href={it.href} className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${urgent ? 'bg-[rgba(255,59,48,0.08)] border-[rgba(255,59,48,0.3)] text-[var(--c-danger)] hover:bg-[rgba(255,59,48,0.14)]' : 'bg-[var(--c-fill)] border-[var(--c-border)] text-[var(--c-text)] hover:border-[var(--c-gold)]'}`}>
              <Icon size={11} className="flex-shrink-0" />
              <span className="whitespace-nowrap">{it.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
