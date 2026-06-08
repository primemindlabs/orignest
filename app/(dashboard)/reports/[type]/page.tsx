export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportClient } from './ReportClient';
import { ALLOWED_REPORT_TYPES, type ReportType } from '@/lib/reports';

export const metadata: Metadata = { title: 'Report' };

export default function ReportTypePage({ params }: { params: { type: string } }) {
  if (!ALLOWED_REPORT_TYPES.includes(params.type as ReportType)) notFound();
  return <ReportClient type={params.type as ReportType} />;
}
