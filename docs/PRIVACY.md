# Privacy implementation summary

One Thing does not contain ads and does not sell personal data.

## Data stored in Supabase

Account profile, goals, tasks, sessions, daily signals, recommendations and corrections, observations, routines, and subscription access are stored under the authenticated user ID. Row-level security restricts every user-owned table to that user. Population priors, LLM quota accounting, and entitlement writes are server-only.

The health integrations request read-only sleep access. Raw health samples are processed on the device and are not uploaded. Only the resulting sleep duration, day, and source (`healthkit`, `health_connect`, or `manual`) are stored.

## External processors

- Anthropic receives user free text only for an explicitly requested onboarding parse, natural-language action, or eligible weekly summary. Requests pass through an authenticated, quota-limited Edge Function.
- RevenueCat receives the Supabase user ID as its app user ID and store purchase/entitlement information.
- Sentry receives production crash and technical context with default PII disabled. User and request objects are removed before sending.
- PostHog receives only named, typed product events with numeric, boolean, or fixed-enum properties. Touch autocapture, session replay, lifecycle autocapture, GeoIP, task text, prompts, email, and health values are disabled or excluded.

## User controls

The You tab exposes calendar and health connection state, observation removal, a complete JSON export, sign-out, and permanent account deletion. Export is assembled locally and opened in the device mail composer or share sheet. Deletion calls trusted server code that removes the auth user; database foreign keys cascade through all user-owned rows. The associated RevenueCat customer is deleted when the RevenueCat server secret is configured.
