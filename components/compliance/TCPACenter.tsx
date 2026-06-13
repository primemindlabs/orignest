'use client';

// Phase 116 — LO Compliance Snapshot: who can be contacted, by what channel, with
// what restrictions, plus a consent-log export for audits.
import { useEffect, useState } from 'react';
import { IconDownload, IconShieldCheck } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface Contact {
  lead_id: string;
  name: string;
  phone: string | null;
  sms_status: 'opted_in' | 'opted_out' | 'consented' | 'off' | 'never_set';
  email_opted_in: boolean;
  contact_hours: string | null;
  categories: { loan_updates: boolean; reminders: boolean; marketing: boolean } | null;
  last_event: { event_type: string; occurred_at: string } | null;
}

const SMS_BADGE: Record<Contact['sms_status'], { label: string; cls: string }> = {
  opted_in: { label: 'SMS opted in', cls: 'bg-green-50 text-green-600' },
  consented: { label: 'SMS consented', cls: 'bg-green-50 text-green-600' },
  off: { label: 'SMS off', cls: 'bg-amber-50 text-amber-600' },
  opted_out: { label: 'SMS opted out', cls: 'bg-red-50 text-red-500' },
  never_set: { label: 'No consent', cls: 'bg-gray-100 text-gray-400' },
};

export function TCPACenter() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/compliance/tcpa')
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.contacts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconShieldCheck size={18} className="text-[#C9A95C]" />
          <h1 className="text-xl font-semibold text-gray-900">TCPA & Communication Center</h1>
        </div>
        <a
          href="/api/compliance/tcpa/export"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <IconDownload size={15} /> Export consent log
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-sm text-gray-400">No contacts with a phone on file.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Contact', 'SMS', 'Email', 'Contact hours', 'Last consent event'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contacts.map((c) => {
                  const badge = SMS_BADGE[c.sms_status];
                  return (
                    <tr key={c.lead_id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                        {c.categories && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            {[c.categories.loan_updates && 'updates', c.categories.reminders && 'reminders', c.categories.marketing && 'marketing'].filter(Boolean).join(' · ') || 'no categories'}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">{c.email_opted_in ? 'Opted in' : 'Off'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{c.contact_hours ?? '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {c.last_event ? (
                          <>
                            {c.last_event.event_type.replace(/_/g, ' ')} · {formatDistanceToNow(new Date(c.last_event.occurred_at), { addSuffix: true })}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
