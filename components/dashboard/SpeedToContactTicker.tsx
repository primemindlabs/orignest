'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UncontactedLead {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
  phone: string | null;
}

function getElapsed(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getUrgencyClass(seconds: number): string {
  if (seconds < 300) return 'text-green'; // 0-5 min
  if (seconds < 1800) return 'text-[#C9A95C]'; // 5-30 min — gold
  if (seconds < 3600) return 'text-orange'; // 30-60 min
  return 'text-red'; // 60+ min
}

function getUrgencyBg(seconds: number): string {
  if (seconds < 300) return 'bg-green/5';
  if (seconds < 1800) return 'bg-[#C9A95C]/5';
  if (seconds < 3600) return 'bg-orange/5';
  return 'bg-red/5';
}

export function SpeedToContactTicker() {
  const [leads, setLeads] = useState<UncontactedLead[]>([]);
  const [tick, setTick] = useState(0);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLeads = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('leads')
      .select('id, first_name, last_name, created_at, phone')
      .eq('stage', 'new_inquiry')
      .is('first_contacted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(8);
    setLeads((data as UncontactedLead[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchLeads();

    // Realtime subscription
    channelRef.current = supabase
      .channel('uncontacted-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    // Tick every second
    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      clearInterval(interval);
      channelRef.current?.unsubscribe();
    };
  }, [fetchLeads, supabase]);

  const handleContact = async (lead: UncontactedLead) => {
    setContactingId(lead.id);
    // Mark first_contacted_at
    await supabase
      .from('leads')
      .update({ first_contacted_at: new Date().toISOString() })
      .eq('id', lead.id);

    // Remove from list immediately (optimistic)
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    setContactingId(null);

    // Open phone dialer if available
    if (lead.phone) {
      window.location.href = `tel:${lead.phone}`;
    } else {
      window.location.href = `/leads/${lead.id}`;
    }
  };

  if (leads.length === 0) return null;

  const hasUrgent = leads.some((l) => getElapsed(l.created_at) >= 3600);
  const maxElapsed = Math.max(...leads.map((l) => getElapsed(l.created_at)));

  return (
    <div
      className={`bg-white rounded-[10px] border shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200 ${
        hasUrgent
          ? 'border-red/30 shadow-[0_0_0_2px_rgba(255,59,48,0.12),0_2px_8px_rgba(0,0,0,0.06)]'
          : 'border-black/[0.06]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.06]">
        <div className="relative flex items-center justify-center">
          <div
            className={`w-2 h-2 rounded-full ${hasUrgent ? 'bg-red' : 'bg-orange'}`}
          />
          {hasUrgent && (
            <div className="absolute w-4 h-4 rounded-full bg-red/20 animate-ping" />
          )}
        </div>
        <p className="text-[13px] font-semibold text-black">
          {leads.length} uncontacted lead{leads.length !== 1 ? 's' : ''}
        </p>
        <p className="text-[11px] text-[#6C6C70] ml-auto">
          Speed-to-Contact
        </p>
      </div>

      {/* Lead rows */}
      <div className="divide-y divide-black/[0.04]">
        {leads.map((lead) => {
          const elapsed = getElapsed(lead.created_at);
          const urgencyColor = getUrgencyClass(elapsed);
          const bgClass = getUrgencyBg(elapsed);

          return (
            <div
              key={lead.id}
              className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-200 ${bgClass}`}
            >
              {/* Initials */}
              <div className="w-6 h-6 rounded-full bg-[rgba(0,122,255,0.1)] flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-blue">
                  {lead.first_name[0]}{lead.last_name[0]}
                </span>
              </div>

              {/* Name */}
              <p className="text-[13px] font-medium text-black flex-1 truncate">
                {lead.last_name}, {lead.first_name}
              </p>

              {/* Timer */}
              <span
                className={`text-[12px] font-mono font-semibold tabular-nums flex-shrink-0 ${urgencyColor}`}
              >
                [{formatElapsed(elapsed)}]
              </span>

              {/* Call button */}
              <button
                onClick={() => handleContact(lead)}
                disabled={contactingId === lead.id}
                className="flex items-center gap-1 h-6 px-2.5 rounded-md bg-blue text-white text-[11px] font-medium hover:bg-blue/90 active:bg-blue/80 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Phone size={10} />
                <span>Call</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {maxElapsed >= 300 && (
        <div className="px-4 py-2 bg-[rgba(60,60,67,0.02)] border-t border-black/[0.04]">
          <p className="text-[10px] text-[#AEAEB2]">
            Industry benchmark: contact within 5 minutes increases conversion by 400%
          </p>
        </div>
      )}
    </div>
  );
}
