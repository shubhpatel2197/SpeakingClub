import * as Sentry from "@sentry/node";

Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })