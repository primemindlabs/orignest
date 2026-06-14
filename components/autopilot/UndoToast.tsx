'use client';

import { useEffect, useState } from 'react';

type Props = {
  deadline: Date;
  onUndo: () => void;
  onExpire?: () => void;
};

/** Phase 128 — the 5-minute undo window. Bottom-right, counts down, then dismisses. */
export function UndoToast({ deadline, onUndo, onExpire }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (secondsLeft === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-[#1A1A1A] text-white rounded-xl px-5 py-4 shadow-xl flex items-center gap-4 z-50">
      <div>
        <p className="text-sm font-medium">Action approved — sending soon</p>
        <p className="text-xs text-white/60">
          Undo available for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </p>
      </div>
      <button onClick={onUndo} className="text-[#C9A95C] text-sm font-medium hover:underline flex-shrink-0">
        Undo
      </button>
    </div>
  );
}
