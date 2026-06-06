import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ashley AI — Your AI Mortgage Assistant',
    template: '%s | Ashley AI',
  },
  description: 'Ashley AI answers leads in seconds, follows up automatically, collects documents, updates your pipeline, and helps you close more loans.',
  keywords: ['mortgage CRM', 'AI mortgage assistant', 'loan officer software', 'TRID compliance', 'mortgage pipeline', 'mortgage broker software'],
  authors: [{ name: 'PrimeMind Labs' }],
  // Use `||` (not `??`) so an empty-string env var also falls back — an empty
  // NEXT_PUBLIC_APP_URL would otherwise crash the build with `new URL("")`.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.orignest.com'),
  openGraph: {
    type: 'website',
    title: 'Ashley AI — Your AI Mortgage Assistant',
    description: 'The AI mortgage assistant that never sleeps.',
    siteName: 'Ashley AI',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="bg-bg font-sans antialiased">
          {children}
          <Toaster
            richColors
            position="top-right"
            expand={false}
            toastOptions={{
              style: {
                fontFamily: 'var(--font-inter), -apple-system, sans-serif',
                fontSize: '13px',
                borderRadius: '10px',
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
