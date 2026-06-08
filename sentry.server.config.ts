import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  environment: process.env.NODE_ENV,

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
      event.request.data = '[SCRUBBED]';
    }
    if (event.extra) {
      event.extra = scrubObj(event.extra as Record<string, unknown>);
    }
    return event;
  },
});
