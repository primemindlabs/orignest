/** @type {import('next').NextConfig} */
const nextConfig = {
  // Both type and lint errors fail the build (baselines cleared).
  // .eslintrc.json extends next/core-web-vitals; 0 errors, 13 known warnings
  // (no-img-element, exhaustive-deps) which Next does not fail the build on.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr'],
  },
  images: {
    domains: ['img.clerk.com', 'images.clerk.dev', 'dhnxiijduycmzfjmohyp.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },
  // Phase 29.1 — permanent redirects for the loan-file routes that moved so any
  // bookmarks or deep links keep working.
  redirects: async () => [
    { source: '/loans/:id/1003', destination: '/loans/:id/application', permanent: true },
    { source: '/loans/:id/1003/:sub*', destination: '/loans/:id/application/:sub*', permanent: true },
    { source: '/loans/:id/conditions', destination: '/loans/:id/docs-compliance/conditions', permanent: true },
    { source: '/loans/:id/documents', destination: '/loans/:id/docs-compliance/documents', permanent: true },
    { source: '/loans/:id/portal', destination: '/loans/:id/portal-comms/borrower-portal', permanent: true },
  ],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};

export default nextConfig;
