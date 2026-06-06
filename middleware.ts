import { clerkMiddleware } from '@clerk/nextjs/server';

// Clerk v5 requires clerkMiddleware() to be present for auth() to work in
// Server Components / Route Handlers. Keep this file minimal and free of
// Node-only imports so it stays edge-compatible.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|otf|map|txt|xml|json)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
