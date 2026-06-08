export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import PreApprovalClient from './PreApprovalClient';

export const metadata: Metadata = { title: 'Pre-Approval Letter' };

export default function PreApprovalPage() {
  return <PreApprovalClient />;
}
