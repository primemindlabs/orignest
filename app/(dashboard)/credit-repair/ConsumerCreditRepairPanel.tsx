'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Mail, Trophy, Bell, ShieldCheck } from 'lucide-react';

interface Enrollment {
  id: string;
  status: string;
  subscription_status: string;
  target_score: number;
  current_score_exp: number | null;
  current_score_eqx: number | null;
  current_score_tu: number | null;
  leads: { first_name: string; last_name: string } | null;
}
interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  sent_at: string;
  read_at: string | null;
  enrollment_id: string;
  leads: { first_name: string; last_name: string } | null;
}
interface Stats { enrolledCount: number; activeDisputes: number; mortgageReadyMTD: number; unread: number }

function avg(e: Enrollment): number {
  const v = [e.current_score_exp, e.current_score_eqx, e.current_score_tu].filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

function notifText(n: Notification): string {
  const name = n.leads ? `${n.leads.first_name} ${n.leads.last_name}` : 'A borrower';
  const p = n.payload ?? {};
  switch (n.type) {
    case 'mortgage_ready': return `🎉 ${name} hit ${p.score ?? ''} — mortgage ready!`;
    case 'item_removed': return `✅ ${p.creditor ?? 'An item'} removed from ${name}'s ${p.bureau ?? ''} report`;
    case 'score_milestone': return `📊 ${name}'s score increased to ${p.score ?? ''}`;
    case 'dispute_sent': return `📬 ${name} sent ${p.count ?? ''} dispute letter(s)`;
    case 'bureau_response': return `📨 ${name} logged a bureau response (${p.outcome ?? ''})`;
    default: return `${name}: ${n.type}`;
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending_upload: 'bg-black/[0.06] text-label-2',
  analyzing: 'bg-blue/10 text-blue',
  active: 'bg-blue/10 text-blue',
  mortgage_ready: 'bg-green/10 text-green',
  closed: 'bg-black/[0.06] text-label-3',
  canceled: 'bg-red/10 text-red',
};

export function ConsumerCreditRepairPanel() {
  const [stats, setStats] = useState<Stats>({ enrolledCount: 0, activeDisputes: 0, mortgageReadyMTD: 0, unread: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/credit-repair/overview');
      if (res.ok) {
        const j = (await res.json()) as { stats: Stats; notifications: Notification[]; enrollments: Enrollment[] };
        setStats(j.stats); setNotifications(j.notifications ?? []); setEnrollments(j.enrollments ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (stats.enrolledCount === 0 && enrollments.length === 0) return null;

  const cards = [
    { label: 'Enrolled Borrowers', value: stats.enrolledCount, icon: Users },
    { label: 'Active Disputes', value: stats.activeDisputes, icon: Mail },
    { label: 'Mortgage-Ready (MTD)', value: stats.mortgageReadyMTD, icon: Trophy },
    { label: 'Unread Updates', value: stats.unread, icon: Bell },
  ];

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 mb-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-blue" />
        <h2 className="text-sm font-semibold text-label">Consumer Credit Repair</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-black/[0.06] px-3.5 py-3">
            <c.icon size={16} className="text-blue mb-1.5" />
            <div className="text-xl font-bold text-label">{c.value}</div>
            <div className="text-[11px] text-label-2">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notifications feed */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-label-3 mb-2">Recent Activity</p>
          {notifications.length === 0 ? (
            <p className="text-xs text-label-3">No activity yet.</p>
          ) : (
            <div className="space-y-1.5">
              {notifications.slice(0, 8).map((n) => (
                <Link key={n.id} href={`/credit-repair/enrollment/${n.enrollment_id}`} className="flex items-center justify-between gap-2 text-xs text-label-2 hover:text-label py-1">
                  <span className="truncate">{notifText(n)}</span>
                  <span className="text-label-3 whitespace-nowrap">{new Date(n.sent_at).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Enrolled borrowers */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-label-3 mb-2">Enrolled Borrowers</p>
          {enrollments.length === 0 ? (
            <p className="text-xs text-label-3">None enrolled yet.</p>
          ) : (
            <div className="space-y-1.5">
              {enrollments.slice(0, 8).map((e) => (
                <Link key={e.id} href={`/credit-repair/enrollment/${e.id}`} className="flex items-center justify-between gap-2 py-1 hover:bg-bg rounded-lg px-1">
                  <span className="text-sm text-label truncate">{e.leads ? `${e.leads.first_name} ${e.leads.last_name}` : 'Borrower'}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-label-2">{avg(e) || '—'}/{e.target_score}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[e.status] ?? 'bg-black/[0.06] text-label-2'}`}>{e.status.replace(/_/g, ' ')}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
