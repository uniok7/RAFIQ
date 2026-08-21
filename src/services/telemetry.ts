import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import { env } from '@/src/lib/env';

type AnalyticsEvents = {
  day_n_open: { n: number };
  main_win_accepted: { blockMins: number };
  main_win_corrected: { correction: 'priority' | 'entirely' };
  session_started: { plannedMins: number };
  session_completed: { plannedMins: number; completed: boolean };
  night_review_completed: { plannedCount: number; completedCount: number };
  observation_shown: { key: 'estimate_multiplier' | 'sleep_effect' | 'avoidance' | 'short_nights'; evidenceCount: number };
  trial_started: { trialDays: 7 };
  subscribed: { packageType: 'monthly' | 'annual' | 'other' };
};

Sentry.init({
  dsn: env.sentryDsn,
  enabled: Boolean(env.sentryDsn) && !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    delete event.user;
    delete event.request;
    return event;
  },
});

const analytics = env.posthogKey
  ? new PostHog(env.posthogKey, {
      host: env.posthogHost,
      captureAppLifecycleEvents: false,
      disableGeoip: true,
      enableSessionReplay: false,
    })
  : null;

export function track<Event extends keyof AnalyticsEvents>(event: Event, properties: AnalyticsEvents[Event]) {
  analytics?.capture(event, properties);
}

export function captureError(error: unknown) {
  if (env.sentryDsn) Sentry.captureException(error);
}

export function resetTelemetry() {
  analytics?.reset();
  Sentry.setUser(null);
}
