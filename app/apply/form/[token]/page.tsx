'use client';

import { useParams } from 'next/navigation';
import { ApplyFlow } from '@/components/apply/ApplyFlow';

export default function ApplyFormPage() {
  const { token } = useParams<{ token: string }>();
  return <ApplyFlow token={token} />;
}
