# Release checklist

## Automated gates

- [x] Remove the unused `react-native-reanimated` 4 and `react-native-worklets` packages, which are incompatible with the required legacy architecture.
- [x] `npm ci` succeeds on Node 20.19+.
- [x] Review the documented `npm audit --omit=dev` exception: 26 transitive Expo/Metro/config-plugin advisories remain because npm offers only incompatible major-version fixes.
- [x] `npm run verify` passes lint, strict TypeScript, and all pure/unit tests.
- [ ] CI Deno checks all three Edge Functions.
- [ ] `npm run test:rls` passes against the release Supabase schema.
- [x] `npx expo install --check` reports no unexpected SDK package versions.
- [x] `npx expo config --type introspect` shows HealthKit descriptions/entitlements, Health Connect read permission, notification plugin, and `newArchEnabled: false`.

## Service configuration

- [ ] Apple, Google, and magic-link auth succeed with the production redirect URL.
- [ ] All six migrations are applied and all three Edge Functions are deployed.
- [ ] Anthropic, Supabase service-role, RevenueCat, and webhook secrets exist only in server/EAS secret storage.
- [ ] RevenueCat products, current offering, `pro` entitlement, webhook Authorization header, and sandbox accounts are configured.
- [ ] Sentry source-map variables and PostHog project values are configured.

## Physical device acceptance

- [ ] Complete every item in `docs/M2_DEVICE_TEST.md` on a current iPhone and Android Health Connect device.
- [ ] Verify Apple, Google, and magic-link sign-in on devices.
- [ ] Verify monthly/annual purchase, cancel, renewal, restore, and reader mode using store sandbox accounts.
- [ ] Verify morning, break-return, and night notifications never exceed three in a local day.
- [ ] Verify large text, VoiceOver/TalkBack labels, keyboard focus, reduced motion, light/dark system settings, and offline/reconnect behavior.
- [ ] Verify JSON export opens with the complete dataset and deletion prevents the old account from signing back in.

## Distribution

- [ ] Set production bundle IDs/package IDs, icons, screenshots, privacy labels/data safety form, support URL, and privacy-policy URL.
- [ ] Run `eas build --profile production --platform ios` and submit to TestFlight.
- [ ] Run `eas build --profile production --platform android` and submit to the Play internal track.
- [ ] Install both store-delivered builds, repeat smoke tests, and review Sentry/PostHog for accidental free-text properties before inviting testers.
