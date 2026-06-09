import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/terms',
  '/api/webhooks(.*)',      // Stripe / Twilio — verified by signature
  '/api/v1(.*)',            // REST API — verified by API key
  '/api/cron(.*)',          // Scheduled jobs — verified by Bearer CRON_SECRET
  '/api/unsubscribe(.*)',   // CAN-SPAM one-click unsubscribe — signed token, no login
  '/api/borrower-portal(.*)', // Borrower/co-borrower portal APIs — token-gated
  '/api/partner-portal(.*)',  // Partner portal APIs — token-gated
  '/api/portal(.*)',          // Realtor + title-agent portal APIs — token-gated
  '/icon(.*)', '/apple-icon(.*)', '/favicon(.*)',  // app icons
  '/(borrower)(.*)',        // Borrower portal — token-authenticated
  '/status/(.*)',           // Borrower status pages
  '/cert/(.*)',             // Shareable pre-approval certificate — token-gated
  '/certificate/(.*)',      // Phase 52 pre-approval certificate — public token URL
  '/review/(.*)',           // Annual homeownership review — unguessable id, noindex
  '/(partner)(.*)',         // Partner portal — token-authenticated
  '/portal/realtor/(.*)',   // Realtor portal — token-authenticated, permission-walled
  '/portal/title/(.*)',     // Title agent portal — token-authenticated, closing-only
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  // Clerk v5: `auth` is a function returning the auth object (`await` is a safe no-op
  // if it ever returns synchronously). We redirect unauthenticated users explicitly
  // instead of `auth().protect()`: on a Clerk *development* instance, `protect()`
  // can't complete the dev-browser handshake on a hard navigation and rewrites the
  // request to a 404 ("protect-rewrite / dev-browser-missing"). An explicit redirect
  // to /sign-in is deterministic and works on both dev and production instances.
  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
