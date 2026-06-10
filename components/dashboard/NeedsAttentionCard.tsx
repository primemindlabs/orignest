'use client';

import Link from 'next/link';
import { IconClock, IconClipboardX, IconCircleCheck } from '@tabler/icons-react';

interface AlertedLead {
  id: string;
  name: string;
  stage: string;
  alertType: 'stalled' | 'conditions';
  alertDetail: string;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New',
  pre_qual: 'Pre-qual',
  application: 'App',
  processing: 'Processing',
  underwriting: 'UW',
  conditional_approval: 'Cond.',
  clear_to_close: 'CTC',
};

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function NeedsAttentionCard({ leads }: { leads: AlertedLead[] }) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F' }}>Needs attention</span>
        <span style={{ fontSize: 10, color: '#b85c20' }}>
          {leads.length} loan{leads.length !== 1 ? 's' : ''}
        </span>
      </div>

      {leads.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '26px 12px', color: '#86868B' }}>
          <IconCircleCheck size={20} color="#1a7a3c" />
          <span style={{ fontSize: 11 }}>Nothing needs attention</span>
        </div>
      ) : (
        leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderBottom: '0.5px solid rgba(0,0,0,0.05)',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#F5EFE0',
                border: '1.5px solid #C9A95C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9.5,
                fontWeight: 600,
                color: '#876830',
                flexShrink: 0,
              }}
            >
              {initials(lead.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#C4724A', marginTop: 1 }}>
                {lead.alertType === 'stalled' && (
                  <>
                    <IconClock size={11} /> No activity {lead.alertDetail}
                  </>
                )}
                {lead.alertType === 'conditions' && (
                  <>
                    <IconClipboardX size={11} /> {lead.alertDetail} open condition{lead.alertDetail === '1' ? '' : 's'}
                  </>
                )}
              </div>
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                color: '#6E6E73',
                background: '#f5f5f3',
                border: '0.5px solid rgba(0,0,0,0.06)',
                borderRadius: 5,
                padding: '2px 7px',
                flexShrink: 0,
              }}
            >
              {STAGE_LABELS[lead.stage] ?? lead.stage}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
