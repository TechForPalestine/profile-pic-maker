// This file configures the initialization of Sentry for edge features
// (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const environment = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: 'https://4a6b1cf4e6a502d96b70523febe8115d@o4509248403931136.ingest.de.sentry.io/4511576394432592',

  environment,

  // Do not collect user info. userInfo: false prevents populating user.* fields
  // (id, email, username, ip_address); httpBodies: [] disables request/response
  // body capture.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  // Capture 100% of traces in dev, 10% in production. Adjust for your traffic.
  tracesSampleRate: environment === 'development' ? 1.0 : 0.1,

  // Setting this option to true will print useful information to the console
  // while you're setting up Sentry.
  debug: false,

  beforeSend(event) {
    // Drop local/development/preview errors so they don't pollute the
    // production Sentry project.
    if (environment !== 'production') {
      return null;
    }
    return event;
  },
});
