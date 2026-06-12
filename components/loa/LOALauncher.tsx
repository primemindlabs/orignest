'use client';

import { useState } from 'react';
import { LOAButton } from './LOAButton';
import { LOAPanel } from './LOAPanel';

/**
 * Mounts the LOA floating button + slide-in panel in the dashboard shell.
 * Self-contained open/close state so the layout can stay a server component.
 */
export function LOALauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && <LOAButton onClick={() => setOpen(true)} />}
      <LOAPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
