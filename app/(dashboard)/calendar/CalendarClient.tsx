'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Calendar, Clock, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import type { CalendarLoan, MonthlySummary } from './page';

interface CalendarClientProps {
  loans: CalendarLoan[];
  summaries: MonthlySummary[];
  year: number;
  month: number;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const STAGE_TILE_CLASS: Record<string, string> = {
  closed: 'bg-green/10 text-green border border-green/20',
  clear_to_close: 'bg-blue/10 text-blue border border-blue/20',
  conditional_approval: 'bg-[#C9A95C]/10 text-[#b8972c] border border-[#C9A95C]/20',
  underwriting: 'bg-orange/10 text-orange border border-orange/20',
  processing: 'bg-[rgba(60,60,67,0.08)] text-[#6C6C70] border border-black/[0.06]',
};

const STAGE_LABELS: Record<string, string> = {
  closed: 'Closed',
  clear_to_close: 'CTC',
  conditional_approval: 'Cond.',
  underwriting: 'UW',
  processing: 'Processing',
};

// Sparkline component
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke="rgba(0,122,255,0.6)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
      {/* Last point dot */}
      {(() => {
        const lastPt = points[points.length - 1].split(',');
        return (
          <circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            r="2.5"
            fill="#C9A95C"
          />
        );
      })()}
    </svg>
  );
}

export function CalendarClient({ loans, summaries, year, month }: CalendarClientProps) {
  const [selectedLoan, setSelectedLoan] = useState<CalendarLoan | null>(null);
  const router = useRouter();

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1))); // 0=Sun

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;

  // Group loans by date
  const loansByDate: Record<number, CalendarLoan[]> = {};
  for (const loan of loans) {
    if (loan.closing_date) {
      const d = new Date(loan.closing_date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        const day = d.getDate();
        if (!loansByDate[day]) loansByDate[day] = [];
        loansByDate[day].push(loan);
      }
    }
  }

  // Summary calculations
  const closedTotal = loans
    .filter((l) => l.stage === 'closed' && l.closing_date?.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .reduce((s, l) => s + (l.loan_amount ?? 0), 0);

  const projectedTotal = loans
    .filter((l) => l.stage !== 'closed')
    .reduce((s, l) => s + (l.loan_amount ?? 0), 0);

  const monthTotal = closedTotal + projectedTotal;

  const sparklineData = summaries.map((s) => s.total);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Pipeline Calendar</h1>
          <p className="text-[#6C6C70] text-sm mt-0.5">Expected loan closings & revenue forecast</p>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/calendar?month=${prevMonth}`)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[rgba(60,60,67,0.08)] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[17px] font-semibold text-black min-w-[140px] text-center">
            {format(new Date(year, month - 1), 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => router.push(`/calendar?month=${nextMonth}`)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[rgba(60,60,67,0.08)] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-[10px] border border-black/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] px-5 py-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[11px] font-medium text-[#AEAEB2] uppercase tracking-wide">This Month</p>
          <p className="text-2xl font-thin tracking-tight text-black tabular-nums mt-0.5">
            {formatAmount(monthTotal)}
          </p>
        </div>
        <div className="w-px h-10 bg-black/[0.06]" />
        <div>
          <p className="text-[11px] font-medium text-[#AEAEB2] uppercase tracking-wide">Confirmed</p>
          <p className="text-lg font-semibold text-green tabular-nums mt-0.5">{formatAmount(closedTotal)}</p>
        </div>
        <div className="w-px h-10 bg-black/[0.06]" />
        <div>
          <p className="text-[11px] font-medium text-[#AEAEB2] uppercase tracking-wide">Projected</p>
          <p className="text-lg font-semibold text-blue tabular-nums mt-0.5">{formatAmount(projectedTotal)}</p>
        </div>
        <div className="ml-auto flex items-end gap-3">
          <div className="text-right">
            <p className="text-[11px] text-[#AEAEB2]">6-month trend</p>
          </div>
          <Sparkline data={sparklineData} />
        </div>
      </div>

      {/* Calendar grid + detail panel */}
      <div className="flex gap-5">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-[10px] border border-black/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-black/[0.06]">
            {dayNames.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-[#AEAEB2]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells for padding */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-black/[0.04] bg-[rgba(60,60,67,0.01)]" />
            ))}

            {/* Actual days */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayLoans = loansByDate[day] ?? [];
              const isToday = isCurrentMonth && today.getDate() === day;
              const totalDayAmount = dayLoans.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

              return (
                <div
                  key={day}
                  className={`min-h-[80px] border-r border-b border-black/[0.04] p-1.5 transition-colors ${
                    dayLoans.length > 0 ? 'hover:bg-blue/[0.02] cursor-pointer' : ''
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-blue text-white text-xs'
                          : 'text-[#6C6C70]'
                      }`}
                    >
                      {day}
                    </span>
                    {dayLoans.length > 0 && totalDayAmount > 0 && (
                      <span className="text-[9px] font-mono text-[#6C6C70] tabular-nums">
                        {formatAmount(totalDayAmount)}
                      </span>
                    )}
                  </div>

                  {/* Loan tiles */}
                  <div className="space-y-0.5">
                    {dayLoans.slice(0, 3).map((loan) => (
                      <button
                        key={loan.id}
                        onClick={() => setSelectedLoan(loan)}
                        className={`w-full text-left px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${
                          STAGE_TILE_CLASS[loan.stage] ?? 'bg-fill text-[#6C6C70]'
                        }`}
                      >
                        {loan.last_name} {loan.loan_amount ? formatAmount(loan.loan_amount) : ''}
                      </button>
                    ))}
                    {dayLoans.length > 3 && (
                      <p className="text-[9px] text-[#AEAEB2] pl-1.5">+{dayLoans.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedLoan && (
            <motion.div
              initial={{ opacity: 0, x: 16, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 280 }}
              exit={{ opacity: 0, x: 16, width: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-[10px] border border-black/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden flex-shrink-0 self-start"
              style={{ width: 280 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
                <p className="text-[13px] font-semibold text-black">Loan Detail</p>
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[rgba(60,60,67,0.08)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Borrower */}
                <div>
                  <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center mb-2">
                    <span className="text-sm font-semibold text-blue">
                      {selectedLoan.first_name[0]}{selectedLoan.last_name[0]}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold text-black">
                    {selectedLoan.first_name} {selectedLoan.last_name}
                  </p>
                  {selectedLoan.loan_amount && (
                    <p className="text-2xl font-thin text-black tabular-nums mt-0.5">
                      {formatAmount(selectedLoan.loan_amount)}
                    </p>
                  )}
                </div>

                {/* Stage */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_TILE_CLASS[selectedLoan.stage] ?? 'bg-fill text-[#6C6C70]'}`}>
                    {STAGE_LABELS[selectedLoan.stage] ?? selectedLoan.stage}
                  </span>
                  {selectedLoan.loan_type && (
                    <span className="text-xs text-[#6C6C70]">{selectedLoan.loan_type.toUpperCase()}</span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2">
                  {selectedLoan.closing_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={13} className="text-[#AEAEB2]" />
                      <span className="text-[#6C6C70]">Closing</span>
                      <span className="ml-auto font-medium text-black">
                        {format(new Date(selectedLoan.closing_date + 'T00:00:00'), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  {selectedLoan.closing_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock size={13} className="text-[#AEAEB2]" />
                      <span className="text-[#6C6C70]">Days away</span>
                      <span className="ml-auto font-medium text-black">
                        {Math.max(0, Math.ceil((new Date(selectedLoan.closing_date + 'T00:00:00').getTime() - Date.now()) / 86400000))} days
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/leads/${selectedLoan.id}`}
                  className="flex items-center justify-center gap-1.5 w-full h-9 rounded-[10px] bg-blue text-white text-sm font-medium hover:bg-blue/90 transition-all"
                >
                  <FileCheck size={14} />
                  Open Lead
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 pt-1">
        <p className="text-[11px] text-[#AEAEB2] font-medium">Legend:</p>
        {[
          { label: 'Closed', color: 'bg-green/10 border-green/20 text-green' },
          { label: 'Clear to Close', color: 'bg-blue/10 border-blue/20 text-blue' },
          { label: 'Conditional', color: 'bg-[#C9A95C]/10 border-[#C9A95C]/20 text-[#b8972c]' },
          { label: 'Underwriting', color: 'bg-orange/10 border-orange/20 text-orange' },
          { label: 'Processing', color: 'bg-[rgba(60,60,67,0.08)] border-black/[0.06] text-[#6C6C70]' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm border ${item.color}`} />
            <span className="text-[11px] text-[#6C6C70]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
