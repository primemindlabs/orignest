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
    default: 'Conduit CRM',
    template: '%s | Conduit CRM',
  },
  description: 'The CRM built for mortgage teams that close. TRID · TCPA · GLBA compliant.',
  keywords: ['mortgage CRM', 'loan officer software', 'TRID compliance', 'mortgage pipeline'],
  authors: [{ name: 'PrimeMind Labs' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.conduitcrm.com'),
  openGraph: {
    type: 'website',
    title: 'Conduit CRM',
    description: 'The CRM built for mortgage teams that close.',
    siteName: 'Conduit CRM',
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
