import { clsx } from 'clsx';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  deltaInvert?: boolean; // true = up is bad (e.g. avg days to close)
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'gold' | 'neutral';
  suffix?: string;
  prefix?: string;
  loading?: boolean;
  /** Phase 65: count-up numeric values (default true). Strings always render as-is. */
  animate?: boolean;
}

const colorClasses = {
  blue: { icon: 'bg-blue/10 text-blue', value: 'text-black' },
  green: { icon: 'bg-green/10 text-green', value: 'text-black' },
  orange: { icon: 'bg-orange/10 text-orange', value: 'text-black' },
  red: { icon: 'bg-red/10 text-red', value: 'text-black' },
  gold: { icon: 'bg-gold/10 text-gold', value: 'text-black' },
  neutral: { icon: 'bg-[rgba(60,60,67,0.08)] text-label-2', value: 'text-black' },
};

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  deltaDirection,
  deltaInvert = false,
  icon,
  color = 'neutral',
  suffix,
  prefix,
  loading = false,
  animate = true,
}: MetricCardProps) {
  // Determine effective direction
  const effectiveUp =
    deltaDirection === 'up' || (deltaDirection === undefined && delta !== undefined && delta > 0);
  const effectiveNeutral = deltaDirection === 'neutral' || delta === 0;

  // Is the delta positive/negative in terms of business meaning?
  const isGood = deltaInvert ? !effectiveUp : effectiveUp;

  const deltaColor = effectiveNeutral
    ? 'text-label-2'
    : isGood
    ? 'text-green'
    : 'text-red';

  const DeltaIcon = effectiveNeutral ? Minus : effectiveUp ? TrendingUp : TrendingDown;

  return (
    <div className="bg-surface rounded-card border border-[rgba(60,60,67,0.12)] shadow-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-label-2 uppercase tracking-wide mb-2">
            {label}
          </p>

          {loading ? (
            <div className="h-9 w-24 bg-[rgba(60,60,67,0.06)] rounded animate-pulse" />
          ) : (
            <p
              className={clsx(
                'text-[32px] leading-none tabular-nums',
                'font-[200] tracking-[-0.05em]',
                colorClasses[color].value
              )}
            >
              {prefix && (
                <span className="text-[18px] font-[300] mr-0.5 text-label-2">{prefix}</span>
              )}
              {animate && typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
              {suffix && (
                <span className="text-[18px] font-[300] ml-0.5 text-label-2">{suffix}</span>
              )}
            </p>
          )}

          {delta !== undefined && !loading && (
            <div className={clsx('flex items-center gap-1 mt-2', deltaColor)}>
              <DeltaIcon size={12} />
              <span className="text-[12px] font-medium">
                {Math.abs(delta)}%{deltaLabel ? ` ${deltaLabel}` : ''}
              </span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={clsx(
              'flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center',
              colorClasses[color].icon
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
