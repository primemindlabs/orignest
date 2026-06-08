'use client';

import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-gradient-to-r from-[rgba(60,60,67,0.06)] via-[rgba(60,60,67,0.10)] to-[rgba(60,60,67,0.06)] bg-[length:200%_100%] animate-shimmer rounded',
        className
      )}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-3.5', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('bg-white rounded-[10px] border border-black/[0.06] p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-black/[0.06]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="px-3 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-3 py-3"><Skeleton className="h-3.5 w-12" /></td>
      <td className="px-3 py-3 text-right"><Skeleton className="h-3.5 w-16 ml-auto" /></td>
      <td className="px-3 py-3"><Skeleton className="h-3.5 w-14" /></td>
      <td className="px-3 py-3 text-center"><Skeleton className="h-3.5 w-8 mx-auto" /></td>
      <td className="px-3 py-3"><Skeleton className="h-3.5 w-20" /></td>
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </tbody>
  );
}

export function SkeletonMetricCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('bg-white rounded-[10px] border border-black/[0.06] p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonActionCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('bg-white rounded-[10px] border border-black/[0.06] p-4', className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-20 rounded-[10px]" />
      </div>
    </div>
  );
}
