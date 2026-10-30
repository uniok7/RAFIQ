# Rafiq

A personal decision engine (not a to-do list). Every morning it picks **one** main
task, shows its reasoning, and sizes a work block to expected energy. When you flag
tiredness it works a deterministic diagnostic ladder. It logs food as coarse, calorie-free
ratings and folds timing into the plan. Every night it closes the day, rolls unfinished
work forward, and takes a one-tap mood check-in.

Current spec: `../MASTER-BUILD-PROMPT.md` (Rafiq) — supersedes the earlier One Thing brief.
This repo scaffolds M1–M7.

## What runs today (no infra needed)

```bash
npm install          # first time
npm run test:engine  # 77 unit tests: scoring, both energy paths + sleep-quality shift,
                     # 15-day gate, the tired ladder, food timing, and the safety rails
npm run typecheck    # strict TS
```

The **decision engine** (`src/engine/`) is pure TypeScript with no React/Supabase/network
imports — the core of the product, fully unit-tested. Start reading at
[`src/engine/plan.ts`](src/engine/plan.ts).

## What needs your accounts/machines

| Piece | Needs |
|---|---|
| Auth, DB, RLS | A Supabase project. Apply `supabase/migrations/0001_init.sql`. |
| Two-user RLS isolation test (§3) | Live Supabase + `SUPABASE_*` env → `npm run test:rls` (CI-gated). |
| LLM proxy (§6) | Deploy `supabase/functions/llm`; set `ANTHROPIC_API_KEY` as a secret. |
| Sleep (§11) | iOS dev build (Mac + Xcode, HealthKit) / Android dev build (Health Connect). Not Expo Go. |
| Payments / errors / analytics | RevenueCat, Sentry, PostHog keys. |

### Setup

1. `cp .env.example .env` and fill `EXPO_PUBLIC_*`.
2. Create a Supabase project; run the migration; deploy the three Edge Functions
   (`llm`, `delete-account`, `export-data`) and set their secrets:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... REVENUECAT_SECRET_KEY=...
   ```
3. Build a dev client (HealthKit/Health Connect are native): `eas build --profile development`.
4. `npm start` and open in the dev client.

## Visual language

The UI takes its look — not its features — from an OxeAI reference: near-black ground,
violet accent, soft rounded cards, one accent word per headline, gradient heroes and CTAs,
progress rings. Feature set is unchanged from the spec (no nutrition/workout/body-comp).
Tokens live in [`src/lib/theme.ts`](src/lib/theme.ts); reusable primitives in `src/components/`
(`Headline`, `GradientCTA`, `SegmentedControl`, `ProgressRing`). Needs `expo-linear-gradient`
and `react-native-svg` (in package.json).

## Layout

```
src/engine/        pure decision engine (§5) + observations (§8) + tests   ← the product
src/lib/           supabase, llm, health, notifications, auth, purchases, analytics, theme
src/store/local.ts offline-first store: local writes queue + sync on reconnect (§2)
src/components/     CorrectableClaim (§7), EmptyState (§9)
app/               expo-router screens: onboarding, (tabs)/{today,goals,assistant,progress,you}, timer, night-review
supabase/          migration + RLS, three Edge Functions, two-user isolation test
```

## Milestone status

- **M1 Skeleton** — schema+RLS+isolation test, auth, Today CRUD, offline queue: **scaffolded**.
- **M2 Sessions/health** — timer+break+return, `sessions` rows, sleep read: **scaffolded** (needs dev build to verify).
- **M3 Onboarding** — LLM proxy + Job A + editable plan + escape hatch: **scaffolded**.
- **M4 Engine** — `src/engine/` + tests, morning card, block sizing, night rollover, recs logged: **done + tested**.
- **M5 Corrections** — all four correction types, Job B, weight adaptation, nightly observations w/ 15-day gate: **scaffolded**.
- **M6 Shell** — Goals/Progress/You, export+delete, RevenueCat, Sentry, PostHog, CI: **scaffolded**.

## Known deferrals (marked in code with `ponytail:`)

- SecureStore session adapter uses direct storage (2KB ceiling); upgrade to AES-in-AsyncStorage only if tokens outgrow it.
- Apple/Google native id-token providers need wiring in the dev build; the Supabase exchange is in `src/lib/auth.ts`.
- Paywall packages, purchase, and the day-8 trigger are wired but only exercise once RevenueCat keys + offerings exist.

## Rafiq additions (M7 + engine deltas)

Built though the spec sequences M7 **after** the day-14 retention decision — noted here so
it's a deliberate call, not an oversight.

- **Engine** (all pure + tested): sleep-quality shift in `energy.ts` (§5.1); the deterministic
  **tired ladder** `tired.ts` (§6, 7 rules, stop-at-first, honest null fallback);
  **food** `food.ts` (borrowed-prior nudges + the 20-day `meal_timing` observation, §7/§9);
  **safety** `safety.ts` (§12) — two-sentence `foodReply`, `dailyGap`, `disorderedEatingGuard`,
  `isRedFlag`. No calories, supplement names, or deficiency claims anywhere — asserted in tests.
- **DB**: `0002_rafiq.sql` adds `meals`, `tired_events`, `day_signals.sleep_quality` +
  `tired_reports`, `profiles.food_commentary_enabled`; the RLS isolation test now covers all of them.
- **LLM**: Job D (meal parse) in the Edge Function; Job B gains `log_meal` / `tired` + `mealText`.
- **Screens**: sleep-quality pills + food row + food nudges + daily gap on Today; the Tired sheet
  (`app/tired.tsx`); meal logging, tired routing, and red-flag escalation in the AI sheet.
- **Guard shipped with the feature**: 0–1 meals for 3 straight days flips `food_commentary_enabled`
  off permanently (logging continues silently) — enforced in the store on every meal add.

## Built out

- **Routine** — editor on You (`RoutineEditor`), checkboxes in Night review, persisted to `routine_items` / `routine_checks`.
- **Paywall** (§12) — `app/paywall.tsx`, shown on day 8 when the trial has lapsed and no entitlement, dismissible (never blocks reads). `trial_started` / `subscribed` tracked.
- **§5.7 stop rule** — the energy call is logged as a recommendation; a `wrong_inference` correction attaches to it, 3 distinct correction-days flip `short_nights`, softening the low-energy call (§5.2) and showing the "I'll stop" banner on Today.
