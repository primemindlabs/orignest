/**
 * Phase 75 — operations persona stat bar (processor / LOA / underwriter).
 * Work-queue metrics instead of revenue: no commission, no goal.
 */
import { IconFolders, IconClipboardList, IconChecklist, IconCalendarEvent } from '@tabler/icons-react';

export interface OperationsStatBarProps {
  filesInQueue: number;
  conditionsOutstanding: number;
  tasksDueToday: number;
  closingThisMonth: number;
}

const cell: React.CSSProperties = {
  padding: '11px 16px',
  borderRight: '0.5px solid rgba(0,0,0,0.06)',
  display: 'flex',
  alignItems: 'center',
  gap: 11,
};
const cap: React.CSSProperties = { fontSize: 11, color: '#6E6E73' };
const val: React.CSSProperties = { fontSize: 19, fontWeight: 500, fontFamily: "'DM Mono', monospace", color: '#1D1D1F' };

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div style={cell}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ ...val, color: accent ?? '#1D1D1F' }}>{value}</div>
        <div style={cap}>{label}</div>
      </div>
    </div>
  );
}

export function OperationsStatBar({ filesInQueue, conditionsOutstanding, tasksDueToday, closingThisMonth }: OperationsStatBarProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        background: '#ffffff',
        border: '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <Stat icon={<IconFolders size={18} color="#876830" />} label="Files in my queue" value={filesInQueue} />
      <Stat
        icon={<IconClipboardList size={18} color="#C4724A" />}
        label="Conditions to clear"
        value={conditionsOutstanding}
        accent={conditionsOutstanding > 0 ? '#C4724A' : undefined}
      />
      <Stat icon={<IconChecklist size={18} color="#876830" />} label="Tasks due today" value={tasksDueToday} />
      <div style={{ ...cell, borderRight: 'none' }}>
        <div style={{ flexShrink: 0 }}>
          <IconCalendarEvent size={18} color="#1a7a3c" />
        </div>
        <div>
          <div style={{ ...val, color: '#1a7a3c' }}>{closingThisMonth}</div>
          <div style={cap}>Closing this month</div>
        </div>
      </div>
    </div>
  );
}
