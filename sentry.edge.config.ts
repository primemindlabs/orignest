import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  environment: process.env.NODE_ENV,

  beforeSend: (event) => {
    if (event.request?.data) {
      event.request.data = '[SCRUBBED]';
    }
    return event;
  },
});
