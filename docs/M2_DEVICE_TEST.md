# M2 device verification

Health APIs are unavailable in Expo Go. Use development builds on physical devices with real sleep samples.

## Build

```sh
eas build --profile development --platform ios
eas build --profile development --platform android
```

The iOS build must show the HealthKit capability and `NSHealthShareUsageDescription`. The Android manifest must contain `android.permission.health.READ_SLEEP`, target API 36, and use min SDK 26.

## iOS

1. Put an asleep sample inside yesterday 18:00–today 12:00 in Apple Health.
2. Open Today → Sleep → Read from health and allow Sleep Analysis.
3. Confirm the duration appears in Today and `day_signals.sleep_source` is `healthkit`.
4. Replace it manually and confirm the displayed value and row change immediately.

## Android

1. Put a `SleepSessionRecord` inside the same window in Health Connect.
2. Open Today → Sleep → Read from health and allow Sleep.
3. Confirm the duration appears and `sleep_source` is `health_connect`.
4. Repeat the manual override check.

## Timer

1. Start a block, background the app, and reopen it. The countdown must reflect elapsed wall time.
2. Finish the block and confirm a five-minute break begins.
3. Background the app through break end. Confirm the local alert and full-width return banner both name the task.
4. Stop a block early and verify `sessions.planned_mins`, `actual_mins`, `interruptions`, `started_at`, and `ended_at`.

If either health permission is rejected or either platform returns no usable data with a valid sample, stop release work and investigate before proceeding.
