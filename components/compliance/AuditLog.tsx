'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { AuditEvent } from '@/types';
import {
  User, FileText, MessageSquare, Settings, CreditCard,
  UserPlus, Shield, Eye, Trash2, Edit3, LogIn,
} from 'lucide-react';

interface AuditLogProps {
  events: AuditEvent[];
  loading?: boolean;
  emptyMessage?: string;
}

function actionIcon(action: string): React.ReactNode {
  if (action.startsWith('lead.')) return <FileText size={13} />;
  if (action.startsWith('document.')) return <FileText size={13} />;
  if (action.startsWith('communication.')) return <MessageSquare size={13} />;
  if (action.startsWith('user.signed_in')) return <LogIn size={13} />;
  if (action.startsWith('user.invited')) return <UserPlus size={13} />;
  if (action.startsWith('user.')) return <User size={13} />;
  if (action.startsWith('pii.')) return <Eye size={13} />;
  if (action.startsWith('settings.')) return <Settings size={13} />;
  if (action.startsWith('billing.')) return <CreditCard size={13} />;
  return <Shield size={13} />;
}

function actionColor(action: string): string {
  if (action.includes('deleted')) return 'bg-red/10 text-red';
  if (action.includes('created')) return 'bg-green/10 text-green';
  if (action.includes('pii')) return 'bg-orange/10 text-orange';
  if (action.includes('billing')) return 'bg-gold/10 text-gold';
  return 'bg-blue/10 text-blue';
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    'lead.created': 'Lead created',
    'lead.updated': 'Lead updated',
    'lead.deleted': 'Lead deleted',
    'lead.stage_changed': 'Stage changed',
    'document.accessed': 'Document accessed',
    'document.uploaded': 'Document uploaded',
    'document.deleted': 'Document deleted',
    'pii.accessed': 'PII data accessed',
    'communication.sent': 'Communication sent',
    'user.signed_in': 'User signed in',
    'user.invited': 'User invited',
    'user.role_changed': 'Role changed',
    'settings.changed': 'Settings updated',
    'billing.changed': 'Billing updated',
  };
  return labels[action] ?? action;
}

export function AuditLog({ events, loading = false, emptyMessage }: AuditLogProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-[rgba(60,60,67,0.04)] rounded-[8px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-label-2">
        {emptyMessage ?? 'No audit events recorded.'}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[rgba(60,60,67,0.06)]">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 py-3">
          {/* Icon */}
          <div
            className={clsx(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
              actionColor(event.action)
            )}
          >
            {actionIcon(event.action)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-black">
                {formatAction(event.action)}
              </p>
              <time className="text-[11px] text-label-3 flex-shrink-0">
                {format(new Date(event.created_at), 'MMM d, h:mm a')}
              </time>
            </div>
            <p className="text-[12px] text-label-2 mt-0.5">
              {event.resource_type} · {event.resource_id.slice(0, 8)}…
            </p>
            {event.ip_address && (
              <p className="text-[11px] text-label-3 mt-0.5">IP: {event.ip_address}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
