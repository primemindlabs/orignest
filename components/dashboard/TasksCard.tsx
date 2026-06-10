'use client';

import Link from 'next/link';
import { IconCircle, IconFlag3, IconChecks } from '@tabler/icons-react';

interface DashTask {
  id: string;
  title: string;
  priority: string; // urgent | normal | low
  leadId: string | null;
  dueLabel: string | null;
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#C4724A',
  normal: '#876830',
  low: '#86868B',
};

export function TasksCard({ tasks }: { tasks: DashTask[] }) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F' }}>Today&apos;s tasks</span>
        <Link href="/my-tasks" style={{ fontSize: 10, color: '#876830', textDecoration: 'none' }}>
          View all
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '22px 12px', color: '#86868B' }}>
          <IconChecks size={18} color="#1a7a3c" />
          <span style={{ fontSize: 11 }}>No tasks due today</span>
        </div>
      ) : (
        tasks.map((t) => {
          const inner = (
            <>
              {t.priority === 'urgent' ? (
                <IconFlag3 size={13} color={PRIORITY_COLOR.urgent} style={{ flexShrink: 0 }} />
              ) : (
                <IconCircle size={13} color={PRIORITY_COLOR[t.priority] ?? '#86868B'} style={{ flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </span>
              {t.dueLabel && <span style={{ fontSize: 10, color: '#86868B', flexShrink: 0 }}>{t.dueLabel}</span>}
            </>
          );
          const rowStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            textDecoration: 'none',
          };
          return t.leadId ? (
            <Link key={t.id} href={`/leads/${t.leadId}`} style={rowStyle}>
              {inner}
            </Link>
          ) : (
            <div key={t.id} style={rowStyle}>
              {inner}
            </div>
          );
        })
      )}
    </div>
  );
}
