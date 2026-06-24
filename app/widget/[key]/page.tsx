import type { Metadata } from 'next';
import { WidgetChat } from './WidgetChat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chat', robots: { index: false, follow: false } };

// Public, iframe-embedded chat surface. No dashboard chrome, no auth.
export default async function WidgetPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return (
    <div style={{ height: '100vh', margin: 0 }}>
      <WidgetChat widgetKey={key} />
    </div>
  );
}
