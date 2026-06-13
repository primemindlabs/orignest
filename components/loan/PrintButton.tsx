'use client';

import { IconPrinter } from '@tabler/icons-react';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
    >
      <IconPrinter size={15} /> Print / Save as PDF
    </button>
  );
}
