# One Thing

One Thing is a native iOS and Android planner that chooses one main win, sizes a focus block from explicit rules, works offline, and lets the user correct every important claim without writing an explanation.

The application is implemented with Expo SDK 54, React Native 0.81, TypeScript, Expo Router, Zustand, React Query, Supabase, RevenueCat, Sentry, and PostHog. Anthropic is reachable only through an authenticated Supabase Edge Function; there is no model API key in the app bundle.

## What is built

- Pre-auth one-question onboarding with voice input, editable AI parsing, Apple/Google/magic-link auth, optional calendar and sleep permissions, and work-hour setup.
- Offline-first task CRUD with optimistic local state, a persisted latest-write queue, reconnect sync, and per-user RLS.
- Deterministic TypeScript planning engine for energy, task scoring, block sizing, top-two reasoning, due dates, rejection, and corrections.
- HealthKit and Health Connect sleep reads, manual fallback, persistent focus/break timer, and a hard cap of three local notifications per day.
- Night review, rollover transaction, routines, 14-day progress, 15-day evidence gating, observations, and natural-language plan actions.
- Goals, progress, settings, permission controls, privacy summary, on-device JSON export, and cascading account deletion.
- Seven app-managed free days with no purchase required up front. Day 8 keeps all existing data readable while new recommendations and AI actions require a RevenueCat entitlement.
- Privacy-safe allowlisted analytics, crash reporting without default PII, CI, RLS isolation tests, and EAS build profiles.

## Local setup

Requirements: Node 20.19 or later, npm, a Supabase project, and an Expo development build. Expo Go is not sufficient because health, speech recognition, purchases, and other native modules are used.

1. Copy `.env.example` to `.env` and fill in the public client values.
2. Run `npm install`.
3. Apply all files in `supabase/migrations` to the Supabase project.
4. Configure Apple, Google, and magic-link auth with `onething://auth/callback` as an allowed redirect.
5. Deploy the three Edge Functions and set their server-only secrets.
6. Build and launch a development client with `eas build --profile development --platform ios` or `eas build --profile development --platform android`, then run `npx expo start --dev-client`.

Useful checks:

```text
npm run verify
npm run test:rls
npx expo install --check
npx expo config --type introspect
```

The RLS test requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` and deliberately creates two temporary users to prove isolation across every user-owned table.

## Environment and secrets

Client-safe values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (defaults to `pro`)
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

Edge Function or CI secrets—never prefix these with `EXPO_PUBLIC_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `REVENUECAT_V1_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID`
- `REVENUECAT_WEBHOOK_AUTH`

For symbolicated production crashes, add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as sensitive EAS build variables. The public DSN alone is enough for local integration testing but not source-map upload.

## RevenueCat setup

Create iOS and Android subscription products, attach them to the `pro` entitlement, and add monthly and/or annual packages to the current offering. The first seven days are controlled by the app and server and do not initiate a store purchase. Configure the RevenueCat webhook URL as:

```text
https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
```

Set its Authorization header to the exact value stored in `REVENUECAT_WEBHOOK_AUTH`. The authenticated `account` function also performs a server-side entitlement refresh immediately after purchase or restore.

## Release

The source is ready for EAS development, preview, and production builds. Store signing, product metadata, sandbox accounts, TestFlight submission, and Play internal-track submission require the owner’s Apple, Google, Expo, Supabase, RevenueCat, Sentry, and PostHog credentials. Follow [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) and complete the physical-device matrix in [docs/M2_DEVICE_TEST.md](docs/M2_DEVICE_TEST.md) before release.

## Architecture note

SDK 54 is intentionally pinned with `newArchEnabled: false`: it is the last Expo SDK that can run the legacy architecture required by `react-native-health`. This is a constrained compatibility bridge, not a long-term upgrade path. Before moving to SDK 55+, replace the Apple Health library with a maintained New-Architecture-compatible implementation, then re-enable the New Architecture and rerun the physical-device matrix.

The unused `react-native-reanimated` 4 and `react-native-worklets` template packages have been removed because Reanimated 4 requires the New Architecture. `npx expo install --check` confirms that the remaining SDK 54 dependencies are current.

`npm audit --omit=dev` currently reports 26 transitive advisories (17 moderate, 9 high) in the pinned Expo/Metro/config-plugin toolchain and its health config-plugin path. npm offers only incompatible major-version changes—primarily Expo 57—to clear them. No forced audit fix was applied because Expo 55+ removes the legacy architecture required by the specified Apple Health library. Reassess this exception when replacing that library.
