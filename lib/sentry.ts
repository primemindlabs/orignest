import * as Sentry from '@sentry/nextjs';

/**
 * Initialize Sentry with PII scrubbing.
 * Call this from sentry.client.config.ts, sentry.server.config.ts, and sentry.edge.config.ts.
 */
export function initSentry(dsn: string, environment: string): void {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    debug: environment === 'development',

    beforeSend(event) {
      // Scrub PII from error payloads before sending to Sentry
      return scrubPIIFromEvent(event);
    },

    beforeSendTransaction(event) {
      return scrubPIIFromTransaction(event);
    },
  });
}

const PII_PATTERNS = [
  // SSN: 9 digits with or without dashes
  /\b\d{3}-?\d{2}-?\d{4}\b/g,
  // Credit card numbers (basic)
  /\b(?:\d[ -]?){13,16}\b/g,
  // Phone numbers
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

const PII_FIELD_NAMES = new Set([
  'ssn',
  'ssn_encrypted',
  'social_security_number',
  'date_of_birth',
  'dob',
  'income',
  'credit_score',
  'password',
  'token',
  'api_key',
  'secret',
  'encryption_key',
]);

function scrubString(value: string): string {
  let scrubbed = value;
  for (const pattern of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELD_NAMES.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = scrubString(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function scrubPIIFromEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.extra) {
    event.extra = scrubObject(event.extra as Record<string, unknown>);
  }

  if (event.contexts) {
    event.contexts = scrubObject(event.contexts as Record<string, unknown>) as typeof event.contexts;
  }

  if (event.request) {
    if (event.request.data) {
      event.request.data = scrubObject(
        typeof event.request.data === 'string'
          ? { body: event.request.data }
          : (event.request.data as Record<string, unknown>)
      );
    }
    // Never include cookies or auth headers in Sentry events
    if (event.request.cookies) {
      event.request.cookies = {};
    }
    if (event.request.headers) {
      const { authorization: _auth, cookie: _cookie, ...safeHeaders } = event.request.headers as Record<string, string>;
      event.request.headers = safeHeaders;
    }
  }

  return event;
}

function scrubPIIFromTransaction(event: Sentry.TransactionEvent): Sentry.TransactionEvent | null {
  // Strip PII from transaction data as well
  if (event.request?.data) {
    event.request.data = '[SCRUBBED]';
  }
  return event;
}

/**
 * Capture an exception with context, without including PII.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(scrubObject(context));
    }
    Sentry.captureException(error);
  });
}
