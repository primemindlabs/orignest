import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',      // Stripe / Twilio — verified by signature
  '/api/v1(.*)',            // REST API — verified by API key
  '/icon(.*)', '/apple-icon(.*)', '/favicon(.*)',  // app icons
  '/(borrower)(.*)',        // Borrower portal — token-authenticated
  '/status/(.*)',           // Borrower status pages
  '/(partner)(.*)',         // Partner portal — token-authenticated
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
