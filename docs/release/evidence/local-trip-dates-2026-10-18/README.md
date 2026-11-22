# Belgian Trip And Reservation Dates - 18 October 2026

## Observed Defect

The unedited 17 October recovery captures show a reservation at 11h50 and the
same trip's change details at 13h50. See the retained
`../local-trip-consent-recovery-native-2026-10-17/` originals. Those captures are
historical evidence, not screenshots of this fix.

`clientTrips.ts` used the server's default timezone for both date and time. The
Android and iOS direct-document trip/payment mappers likewise used the device's
default timezone. A French/Belgian locale does not select a timezone.

## Fix And Regression Coverage

Trip/reservation labels now explicitly use `Europe/Brussels`, matching the
existing change editor and chat trip context. The source instant and booking
revision are unchanged. Android direct trip/payment labels share an immutable
formatter; its calendar filters and initial month use the same Belgian zone.
The corresponding Swift formatters are shared and tested locally using
Foundation, not an iPhone simulator or physical device.

The 15 backend cases cover the reported mismatch, summer/winter offsets, next
day/year, both sides of both clock changes, the repeated autumn hour, supported
stored date forms, immutable booking terms/revisions, and instant-based status.
Each passes in separately launched UTC, Los Angeles and Tokyo processes.
The Web Integration Smoke workflow reruns this three-zone matrix explicitly.

Retained original generated reports:

- `before-utc.json`: 15 cases, 14 failures and 1 pass before the server fix.
- `after-utc.json`, `after-los-angeles.json`, `after-tokyo.json`: 15/15 each.
- `all-functions.json`: 255/255 backend tests passed after the change.
- `services.json`: all 24 isolated multi-person service groups passed, using
  the changed backend. These are not native app or live-provider checks.
- `before-android/`: 30 failing trip/payment mapping cases plus 1 failing
  default-calendar case; the 2 existing explicit-zone calendar cases pass.
- `after-android/`: the same 30 mapping cases and all 3 calendar cases pass.
- `swift-native-checks.txt`: 30 date/time pairs pass across 3 simulated default
  timezones, followed by the existing native policy checks.

The complete Android unit suite also passed 228/228 cases. Android instrumentation
compilation and the Functions TypeScript build passed locally. The Swift check
script's missing `BookingIntentSnapshot.swift` dependency was added so its
existing model checks actually compile; no type stub or fallback was introduced.

## Completed App Replay

The existing four-state consent recovery replay now independently computes the
expected Belgian time on the host and asserts it in both the app's direct trip
summary and each parent's reservation card, before and after reopening. This
test subsequently passed in source `92ea11d`, run 39083223705. The complete
32-group result and original reports are retained in the
[18 October native evidence](../local-trip-history-2026-10-18/README.md).
The previous 17 October run remains evidence only of its own earlier source.

Two history app captures from the completed run were reviewed and added to the
partner portal; on-screen time assertions pass for the direct trip and each
parent's reservation before and after reopening. This report
does not establish production deployment, real-phone behavior, real payments or
refunds, route application, proposal history, drafts or safety tracking. The
overall release/user-flow goal remains open.
