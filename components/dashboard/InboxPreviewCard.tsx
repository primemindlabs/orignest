'use client';

import Link from 'next/link';
import { IconMail, IconMessage, IconInbox } from '@tabler/icons-react';

interface DashMessage {
  id: string;
  from: string;
  channel: string; // sms | email | ...
  snippet: string;
  timeLabel: string;
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

export function InboxPreviewCard({ messages }: { messages: DashMessage[] }) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F' }}>Unread inbox</span>
        <Link href="/inbox" style={{ fontSize: 10, color: '#876830', textDecoration: 'none' }}>
          Open inbox
        </Link>
      </div>

      {messages.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '22px 12px', color: '#86868B' }}>
          <IconInbox size={18} color="#86868B" />
          <span style={{ fontSize: 11 }}>Inbox is clear</span>
        </div>
      ) : (
        messages.map((m) => (
          <Link
            key={m.id}
            href="/inbox"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', textDecoration: 'none' }}
          >
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {m.channel === 'email' ? (
                <IconMail size={14} color="#876830" />
              ) : (
                <IconMessage size={14} color="#3A5C7A" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.from}
                </span>
                <span style={{ fontSize: 10, color: '#86868B', flexShrink: 0 }}>{m.timeLabel}</span>
              </div>
              <div style={{ fontSize: 11, color: '#6E6E73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.snippet}
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
