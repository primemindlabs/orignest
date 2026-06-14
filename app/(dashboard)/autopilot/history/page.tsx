import type { Metadata } from 'next';
import { AutopilotHistory } from '@/components/autopilot/AutopilotHistory';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Autopilot History' };

export default function AutopilotHistoryPage() {
  return (
    <div style={{ padding: '11px 13px' }}>
      <AutopilotHistory />
    </div>
  );
}
