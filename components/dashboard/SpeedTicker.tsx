'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface UncontactedLead {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 60_000;

function getElapsed(createdAt: string): { display: string; level: 'green' | 'yellow' | 'orange' | 'red' } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let level: 'green' | 'yellow' | 'orange' | 'red' = 'green';
  if (minutes >= 60) level = 'red';
  else if (minutes >= 15) level = 'orange';
  else if (minutes >= 5) level = 'yellow';

  return { display, level };
}

const LEVEL_COLORS = {
  green: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/20', dot: 'bg-green' },
  yellow: { bg: 'bg-[#FF9500]/10', text: 'text-orange', border: 'border-orange/20', dot: 'bg-orange' },
  orange: { bg: 'bg-orange/10', text: 'text-orange', border: 'border-orange/20', dot: 'bg-orange' },
  red: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/20', dot: 'bg-red' },
};

export function SpeedTicker() {
  const [leads, setLeads] = useState<UncontactedLead[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/uncontacted');
      if (res.ok) {
        const data = await res.json() as { leads: UncontactedLead[] };
        setLeads(data.leads ?? []);
        setDismissed(false);
      }
    } catch {
      // silently fail — non-critical UI
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    intervalRef.current = setInterval(fetchLeads, POLL_INTERVAL_MS);
    // Tick every second for live timer
    tickIntervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [fetchLeads]);

  if (dismissed || leads.length === 0) return null;

  const oldest = leads[0];
  const { display, level } = getElapsed(oldest.created_at);
  const colors = LEVEL_COLORS[level];
  const hasMultiple = leads.length > 1;

  return (
    <AnimatePresence>
      <motion.div
        key="speed-ticker"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-elevated bg-white ${colors.border}`}
      >
        {/* Pulsing dot */}
        <div className="relative flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <div className={`absolute inset-0 rounded-full ${colors.dot} animate-ping opacity-50`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {hasMultiple ? (
            <p className={`text-[13px] font-semibold ${colors.text}`}>
              {leads.length} new leads waiting
            </p>
          ) : (
            <p className="text-[13px] font-medium text-[#1C1C1E] truncate">
              {oldest.first_name} {oldest.last_name}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Zap size={10} className={colors.text} />
            <span className={`text-[11px] font-mono tabular-nums ${colors.text}`}>
              {display}
            </span>
            <span className="text-[11px] text-[#AEAEB2]">
              {hasMultiple ? `oldest · ${oldest.first_name}` : 'since submit'}
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={hasMultiple ? '/leads?stage=new_inquiry' : `/leads/${oldest.id}`}
          className="flex items-center gap-1 h-7 px-3 rounded-lg bg-[#C9A95C] text-white text-[12px] font-medium hover:bg-[#C9A95C]/90 transition-colors flex-shrink-0"
        >
          Contact Now
          <ChevronRight size={11} />
        </Link>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors text-[#AEAEB2] flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
