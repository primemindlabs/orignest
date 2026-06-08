import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  environment: process.env.NODE_ENV,

  // Strip PII before sending to Sentry
  beforeSend: (event) => {
    const PII_KEYS = ['ssn', 'credit_score', 'income', 'password', 'token', 'date_of_birth', 'encryption_key'];

    function scrubObj(obj: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (PII_KEYS.includes(k.toLowerCase())) {
          out[k] = '[Filtered]';
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          out[k] = scrubObj(v as Record<string, unknown>);
        } else {
          out[k] = v;
        }
      }
      return out;
    }

    if (event.request?.data) {
      event.request.data = scrubObj(
        typeof event.request.data === 'string'
          ? { body: event.request.data }
          : (event.request.data as Record<string, unknown>)
      );
    }
    if (event.extra) {
      event.extra = scrubObj(event.extra as Record<string, unknown>);
    }
    // Never include auth cookies or tokens
    if (event.request?.cookies) event.request.cookies = {};
    if (event.request?.headers) {
      const { authorization: _a, cookie: _c, ...safe } = (event.request.headers ?? {}) as Record<string, string>;
      event.request.headers = safe;
    }
    return event;
  },
});
