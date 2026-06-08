'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Phone, MessageSquare, Mail, Clock, AlertTriangle, Zap, RotateCw, CheckCircle2, ClipboardList, DollarSign, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { TodayAction, TomorrowItem } from './page';

interface TodayClientProps {
  actions: TodayAction[];
  tomorrowItems: TomorrowItem[];
  dateLabel: string;
  greeting: string;
  firstName: string;
  ghostedCount?: number;
}

const TYPE_CONFIG: Record<
  TodayAction['type'],
  { borderColor: string; bgColor: string; dotColor: string }
> = {
  trid_alert: {
    borderColor: 'border-l-red',
    bgColor: 'bg-red/[0.02]',
    dotColor: 'bg-red',
  },
  speed_to_contact: {
    borderColor: 'border-l-orange',
    bgColor: 'bg-orange/[0.02]',
    dotColor: 'bg-orange',
  },
  followup_due: {
    borderColor: 'border-l-blue',
    bgColor: '',
    dotColor: 'bg-blue',
  },
  task_due: {
    borderColor: 'border-l-[rgba(60,60,67,0.3)]',
    bgColor: '',
    dotColor: 'bg-[#6C6C70]',
  },
  app_incomplete: {
    borderColor: 'border-l-[#C9A95C]',
    bgColor: 'bg-[#C9A95C]/[0.02]',
    dotColor: 'bg-[#C9A95C]',
  },
  rate_watch: {
    borderColor: 'border-l-green',
    bgColor: 'bg-green/[0.02]',
    dotColor: 'bg-green',
  },
};

const TYPE_ICON: Record<TodayAction['type'], LucideIcon> = {
  trid_alert: AlertTriangle,
  speed_to_contact: Zap,
  followup_due: RotateCw,
  task_due: CheckCircle2,
  app_incomplete: ClipboardList,
  rate_watch: DollarSign,
};

const TYPE_ICON_COLOR: Record<TodayAction['type'], string> = {
  trid_alert: 'text-red-500',
  speed_to_contact: 'text-amber-500',
  followup_due: 'text-gold-500',
  task_due: 'text-green-500',
  app_incomplete: 'text-orange-500',
  rate_watch: 'text-emerald-600',
};

function ActionCard({
  action,
  onComplete,
}: {
  action: TodayAction;
  onComplete: (id: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const config = TYPE_CONFIG[action.type];

  const handleComplete = async () => {
    setCompleting(true);
    // Small delay for visual effect
    await new Promise((r) => setTimeout(r, 300));
    onComplete(action.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`relative bg-white rounded-[10px] border border-black/[0.06] border-l-2 ${config.borderColor} ${config.bgColor} shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        {/* Type icon */}
        <div className="flex-shrink-0 mt-0.5 leading-none">
          {(() => { const Icon = TYPE_ICON[action.type] ?? Clock; return <Icon className={`w-[18px] h-[18px] ${TYPE_ICON_COLOR[action.type] ?? 'text-gray-400'}`} strokeWidth={1.75} />; })()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-black leading-snug">
            {action.title}
          </p>
          <p className="text-[12px] text-[#6C6C70] mt-0.5 truncate">
            {action.subtitle}
          </p>

          {/* Secondary actions */}
          {action.secondaryActions && action.secondaryActions.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              {action.secondaryActions.map((sa) => {
                if (sa.href) {
                  return (
                    <Link
                      key={sa.label}
                      href={sa.href}
                      className="text-[11px] text-[#6C6C70] hover:text-blue transition-colors"
                    >
                      {sa.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={sa.label}
                    onClick={sa.action === 'complete_task' ? handleComplete : undefined}
                    className="text-[11px] text-[#6C6C70] hover:text-blue transition-colors"
                  >
                    {sa.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {action.ctaHref ? (
            <Link
              href={action.ctaHref}
              className="flex items-center gap-1 h-8 px-3 rounded-[8px] bg-blue text-white text-[13px] font-medium hover:bg-blue/90 transition-all duration-150 shadow-sm"
            >
              {action.type === 'speed_to_contact' && <Phone size={11} />}
              {action.type === 'followup_due' && <Phone size={11} />}
              {action.ctaLabel}
            </Link>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-1 h-8 px-3 rounded-[8px] bg-blue text-white text-[13px] font-medium hover:bg-blue/90 transition-all duration-150 shadow-sm disabled:opacity-50"
            >
              {completing ? (
                <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              ) : null}
              {action.ctaLabel}
            </button>
          )}

          {/* Complete checkmark */}
          <button
            onClick={handleComplete}
            disabled={completing}
            title="Mark complete"
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
              completing
                ? 'border-green bg-green text-white scale-105'
                : 'border-[rgba(60,60,67,0.2)] text-transparent hover:border-green hover:text-green/50'
            }`}
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AllDoneState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className="text-center py-16"
    >
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-xl font-semibold text-black">Nothing left for today.</h2>
      <p className="text-[#6C6C70] text-sm mt-1">Great work. Your pipeline is moving.</p>

      {/* Subtle confetti burst */}
      <div className="relative inline-block mt-6">
        <div className="absolute -inset-4 opacity-20">
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30) * (Math.PI / 180);
            const x = Math.cos(angle) * 40;
            const y = Math.sin(angle) * 40;
            const colors = ['#C9A95C', '#34C759', '#C9A95C', '#FF9500'];
            return (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  backgroundColor: colors[i % colors.length],
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>
        <Link
          href="/pipeline"
          className="relative inline-flex items-center gap-2 h-9 px-5 rounded-[12px] bg-blue text-white text-sm font-medium hover:bg-blue/90 transition-all shadow-sm"
        >
          View Pipeline <ChevronRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

export function TodayClient({
  actions: initialActions,
  tomorrowItems,
  dateLabel,
  greeting,
  firstName,
  ghostedCount = 0,
}: TodayClientProps) {
  const [visibleActions, setVisibleActions] = useState<TodayAction[]>(initialActions);

  const handleComplete = useCallback((id: string) => {
    setVisibleActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const remaining = visibleActions.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-[13px] font-medium text-[#6C6C70] mb-0.5">{dateLabel}</p>
        <h1 className="text-[28px] font-thin tracking-tight text-black leading-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        {remaining > 0 ? (
          <p className="text-[15px] text-[#6C6C70] mt-1">
            You have{' '}
            <span className="font-semibold text-black">{remaining} action{remaining !== 1 ? 's' : ''}</span>{' '}
            today.
          </p>
        ) : (
          <p className="text-[15px] text-[#6C6C70] mt-1">
            All caught up for today.
          </p>
        )}
      </div>

      {/* Ghosted leads recovery (Sprint 2) */}
      {ghostedCount > 0 && (
        <Link
          href="/leads?filter=ghosted"
          className="block rounded-[10px] border border-black/[0.06] border-l-2 border-l-orange bg-orange/[0.03] px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)] hover:bg-orange/[0.06] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-base leading-none">👻</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-black leading-snug">
                {ghostedCount} lead{ghostedCount !== 1 ? 's have' : ' has'} gone silent — Ashley can help recover {ghostedCount !== 1 ? 'them' : 'it'}
              </p>
              <p className="text-[12px] text-[#6C6C70] mt-0.5">Generate stage-aware re-engagement sequences</p>
            </div>
            <ChevronRight size={16} className="text-[#AEAEB2] flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Action cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleActions.length > 0 ? (
            visibleActions.map((action) => (
              <ActionCard key={action.id} action={action} onComplete={handleComplete} />
            ))
          ) : (
            <AllDoneState key="done" />
          )}
        </AnimatePresence>
      </div>

      {/* Tomorrow preview */}
      {tomorrowItems.length > 0 && visibleActions.length > 0 && (
        <div className="pt-4 border-t border-black/[0.06]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">
            Coming up tomorrow
          </p>
          <div className="space-y-2">
            {tomorrowItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center gap-2 text-sm text-[#6C6C70] hover:text-black transition-colors"
              >
                <Clock size={12} className="text-[#AEAEB2]" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
