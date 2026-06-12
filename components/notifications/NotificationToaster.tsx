'use client';

// Phase 87 — realtime notification toasts. Subscribes to INSERTs on `notifications` for
// the current user via Supabase Realtime and slides in a gold-bordered toast (auto-dismiss
// 8s). Complements the existing polled NotificationCenter bell.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconX } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';

type Toast = { id: string; title: string; body: string | null; link: string | null };

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="w-[320px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] shadow-2xl p-3 flex items-start gap-2"
      style={{ borderLeft: '3px solid #C9A95C' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--c-text)] truncate">{toast.title}</p>
        {toast.body && <p className="text-[12px] text-[var(--c-label2)] line-clamp-2 mt-0.5">{toast.body}</p>}
      </div>
      {toast.link && (
        <button
          onClick={() => { router.push(toast.link!); onDismiss(); }}
          className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline flex-shrink-0"
        >
          View
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss" className="h-6 w-6 grid place-items-center rounded-[6px] text-[var(--c-label3)] hover:text-[var(--c-text)] flex-shrink-0">
        <IconX size={13} />
      </button>
    </div>
  );
}

export function NotificationToaster({ userId }: { userId: string | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const mountedAt = useRef<number>(0);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((n: { id: string; title: string; body: string | null; link: string | null }) => {
    if (seen.current.has(n.id)) return;
    seen.current.add(n.id);
    setToasts((prev) => [{ id: n.id, title: n.title, body: n.body, link: n.link }, ...prev].slice(0, 4));
  }, []);

  // Realtime path (works once a Clerk↔Supabase JWT is wired so RLS passes for the browser client).
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => push(payload.new as { id: string; title: string; body: string | null; link: string | null }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, push]);

  // Authed poll fallback — the reliable path under Clerk auth. Only toasts notifications
  // created after this component mounted, so we don't replay the existing backlog.
  useEffect(() => {
    if (!userId) return;
    if (!mountedAt.current) mountedAt.current = Date.now();
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/notifications/recent');
        const d = (await r.json()) as { notifications?: { id: string; title: string; body: string | null; link: string | null; created_at: string }[] };
        if (!alive) return;
        for (const n of (d.notifications ?? []).reverse()) {
          if (new Date(n.created_at).getTime() >= mountedAt.current) push(n);
        }
      } catch { /* ignore */ }
    };
    const t = setInterval(poll, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [userId, push]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-16 right-4 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
