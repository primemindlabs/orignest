'use client';

import { useRouter } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';

export function BackLink() {
  const router = useRouter();
  return (
    <button onClick={() => router.push('/branch')} aria-label="Back to branch dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
      <IconArrowLeft size={18} className="text-gray-500" />
    </button>
  );
}
