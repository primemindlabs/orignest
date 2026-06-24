import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/terms',
  '/hipaa',
  '/api/webhooks(.*)',      // Stripe / Twilio — verified by signature
  '/api/integrations/closa(.*)', // CLOSA partner bridge — Bearer token verified in-handler
  '/apply(.*)',             // Public referral landing + Phase 105 digital 1003 form
  '/api/apply(.*)',         // Phase 105 digital 1003 — public, token-gated (service-role in handler)
  '/api/referrals/apply(.*)', // Public referral form submit — service-role, no PII enumeration
  '/api/marketing/market-update/unsubscribe(.*)', // Public realtor email unsubscribe (id = credential)
  '/api/v1(.*)',            // REST API — verified by API key
  '/api/cron(.*)',          // Scheduled jobs — verified by Bearer CRON_SECRET
  '/api/unsubscribe(.*)',   // CAN-SPAM one-click unsubscribe — signed token, no login
  '/api/borrower-portal(.*)', // Borrower/co-borrower portal APIs — token-gated
  '/api/partner-portal(.*)',  // Partner portal APIs — token-gated
  '/api/portal(.*)',          // Realtor + title-agent portal APIs — token-gated
  '/icon(.*)', '/apple-icon(.*)', '/favicon(.*)',  // app icons
  '/(borrower)(.*)',        // Borrower portal — token-authenticated
  '/status/(.*)',           // Borrower status pages
  '/b/(.*)',                // Phase 106 short borrower-portal link → redirects to /status/[token]
  '/cert/(.*)',             // Shareable pre-approval certificate — token-gated
  '/certificate/(.*)',      // Phase 52 pre-approval certificate — public token URL
  '/title-portal/(.*)',     // Phase 64 title-company portal — token-gated, no login
  '/api/title/(.*)',        // Title portal API — token-verified in handler
  '/deal-desk-respond/(.*)', // Phase 120 AE pricing-response page — HMAC magic-link, no login
  '/api/deal-desk-respond(.*)', // Phase 120 AE response submit — token-verified in handler
  '/refer/(.*)',            // Phase 121 public partner referral landing — code is the credential
  '/api/refer/(.*)',        // Phase 121 public referral submit — rate-limited, code-gated in handler
  '/proposal/(.*)',         // Phase 122 borrower-facing loan proposal — share_token is the credential
  '/api/proposals/(.*)',    // Phase 122 public proposal choose — token-gated in handler
  '/review/(.*)',           // Annual homeownership review — unguessable id, noindex
  '/(partner)(.*)',         // Partner portal — token-authenticated
  '/portal/realtor/(.*)',   // Realtor portal — token-authenticated, permission-walled
  '/portal/title/(.*)',     // Title agent portal — token-authenticated, closing-only
  '/widget/(.*)',           // Phase 146 public website chat widget — public_key + session token gated
  '/api/widget(.*)',        // Phase 146 widget APIs — public_key/session-token verified in handler
]);

// Phase 137 — branded application portals on brokerage subdomains.
// `{brokerage}.ashleyiq.com/{mlo}` is served by `/apply/o/{brokerage}/{mlo}`.
// Reserved subdomains (the app itself) and /api + /_next + /apply paths are never
// rewritten. Brokerage subdomains only serve public apply pages, so we rewrite and
// return immediately — before any auth check.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'ashleyiq.com';
const RESERVED = new Set(['', 'www', 'app', 'api', 'admin', 'dev', 'staging', 'preview']);

function subdomainRewrite(request: NextRequest): URL | null {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (RESERVED.has(sub)) return null;

  const p = request.nextUrl.pathname;
  if (p.startsWith('/api') || p.startsWith('/_next') || p.startsWith('/apply') || p.startsWith('/widget') || p.includes('.')) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/apply/o/${sub}${p === '/' ? '' : p}`;
  return url;
}

export default clerkMiddleware(async (auth, request) => {
  const rewrite = subdomainRewrite(request);
  if (rewrite) return NextResponse.rewrite(rewrite);

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
