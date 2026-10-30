// §14 the only events that matter. §13: never send task titles/goal text/free text.
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const key = Constants.expoConfig?.extra?.posthogKey as string | undefined;
const host = Constants.expoConfig?.extra?.posthogHost as string | undefined;

export const posthog = key ? new PostHog(key, { host }) : null;

export type Event =
  | 'day_n_open'
  | 'main_win_accepted'
  | 'main_win_corrected'
  | 'session_started'
  | 'session_completed'
  | 'night_review_completed'
  | 'meal_logged'
  | 'tired_reported'
  | 'observation_shown'
  | 'trial_started'
  | 'subscribed';

// props are whitelisted primitives only — no free text ever reaches PostHog (§13).
export function track(event: Event, props: Record<string, number | boolean | undefined> = {}) {
  posthog?.capture(event, props);
}
