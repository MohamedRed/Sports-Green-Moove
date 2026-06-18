# Real-Device Release Test Protocol

This protocol is required before public launch. Run it on at least one physical
iOS device and one physical Android device using production provider
configuration. Do not record or commit provider secrets.

## Preconditions

- `npm run validate:provider-readiness` passes in the release environment.
- A driver, parent, and child-device account exist in the production Firebase
  project.
- The selected child profile has guardian consent, club/team membership, and
  child-device tracking enabled.
- The driver has a verified profile, a payout-ready Stripe Connect account, and
  a published ride with child tracking enabled.
- Radar trip webhooks and Stripe webhooks point at the production Firebase
  Functions endpoints.

## Device Matrix

Record the device model, OS version, app build, tester, completed timestamp, and
artifact references in `docs/release/evidence-manifest.json`.

BrowserStack App Automate is the preferred repeatable real-device cloud path when
local physical devices are not available. Use the inert workflow template at
`docs/ci/browserstack-real-device.yml.template` after a maintainer installs it
with a GitHub token that has workflow scope and adds BrowserStack secrets. After
the BrowserStack run, normalize the manifest-ready evidence with:

```bash
npm run browserstack:real-device-evidence -- \
  --input docs/release/evidence/browserstack-real-device-input.json \
  --output docs/release/evidence/browserstack-real-device-evidence.json
```

The normalizer only accepts completed real-device evidence for both platforms and
all required scenarios; it does not fake device evidence.

| Platform | Required device state |
| --- | --- |
| iOS | precise location allowed, always/background location allowed, notifications allowed |
| Android | precise location allowed, background location allowed, notifications allowed, battery optimization state recorded |

## Required Scenarios

Run every scenario for iOS and Android. Each scenario must finish with a
`passed` status in the release evidence manifest and at least one linked
artifact.

| Manifest scenario id | Procedure | Required artifact |
| --- | --- | --- |
| `foreground_tracking` | Start an active ride while driver and child apps are open. Verify the parent sees vehicle and child positions, ETA, and last-update labels. | Screen recording showing parent, driver, and child active ride states. |
| `background_tracking` | Background driver and child apps during the active ride. Keep the parent app open and verify location updates continue. | Screen recording plus `liveTrips/{rideSessionId}` export. |
| `locked_screen_tracking` | Lock driver and child devices for at least three location intervals during the active ride. Verify parent updates continue or stale warning appears correctly. | Screen recording or device log with timestamps plus live-trip export. |
| `gps_loss` | Disable precise/location signal or move into a no-GPS condition during the active ride. Verify stale-location warning and last-update time. | Screenshot of stale warning and live-trip audit export. |
| `network_loss` | Disable network during the active ride, then restore it. Verify app state survives and uploads resume. | Screen recording plus live-trip update timestamps before and after restoration. |
| `app_restart` | Force close and relaunch driver and child apps during an active ride. Verify the active ride is recovered and fallback tracking resumes. | Screen recording and ride-session export. |
| `battery_saver` | Enable platform battery saver or low power mode. Verify the app surfaces tracking risk and active ride state remains coherent. | Screenshot of warning/state and device settings proof. |
| `radar_webhook_delay` | Delay or disable Radar webhook delivery during an active ride, then restore it. Verify native Firebase fallback maintains live state. | Radar event export and Firestore/RTDB fallback export. |
| `firebase_native_fallback` | Confirm native fallback writes `source = nativeFallback` points to `liveTrips/{rideSessionId}` while the ride is active. | `liveTrips` export containing vehicle or child native fallback points. |

## Store Review Captures

Capture screenshots and policy documents for every store review evidence item in
`docs/release/evidence-manifest.example.json`:

| Manifest evidence id | Required capture |
| --- | --- |
| `privacy_policy_url` | Published privacy policy URL covering every processor and child-safety use case. |
| `app_store_privacy_answers` | App Store privacy answers aligned with `privacy-data-safety.md`. |
| `google_play_data_safety_answers` | Google Play Data safety answers aligned with `privacy-data-safety.md`. |
| `guardian_consent_copy` | Guardian consent copy before child tracking starts. |
| `background_location_disclosure` | Prominent background-location disclosure before OS permission prompts. |
| `child_safety_disclosure` | Child safety disclosure explaining role access and active ride limits. |
| `active_ride_tracking_screenshot` | Active ride tracking view. |
| `google_maps_route_preview_screenshot` | Native Google Maps route preview. |
| `stale_location_warning_screenshot` | Stale-location warning state. |
| `emergency_contact_action_screenshot` | Emergency contact action. |
| `permission_education_screenshot` | Permission education before OS permission prompts. |

## Audit Exports

Export the matching Firestore/Realtime Database evidence after the run:

- `rideSessions/{rideSessionId}`
- `rideSessions/{rideSessionId}/auditEvents`
- `liveTrips/{rideSessionId}`
- `notifications` for the driver and parent
- payment and reward-ledger entries for the booking if a paid ride was used
- any support `reports` created during the run

Store the sanitized export as `docs/release/evidence/safety-audit-export.json`
or pass the export path explicitly. Generate the sanitized export from the
production Firestore/Realtime Database records for the completed run:

```bash
npm run export:safety-audit-evidence -- --ride-session-id <rideSessionId> --booking-id <bookingId> --report-id <stripeReportId>
npm run validate:safety-audit-export -- docs/release/evidence/safety-audit-export.json
```

The export must not include secrets, tokens, passwords, API keys, or raw provider
credentials. The validator checks that the export contains guardian consent,
driver pickup, driver dropoff, Radar webhook reconciliation, native fallback
location, and Stripe payment or payout reconciliation records.

## Acceptance

Public launch remains blocked until:

- `npm run validate:provider-readiness` passes with production configuration.
- `npm run validate:safety-audit-export -- docs/release/evidence/safety-audit-export.json`
  passes against the sanitized safety-audit export.
- `npm run validate:release-evidence -- docs/release/evidence-manifest.json`
  passes.
- The manual Release Evidence Gate workflow passes for the same manifest path.
- The manifest links passing automated user-flow evidence for Native CI, Android
  connected UI, production live smokes, Firebase rules, Stripe webhook
  reconciliation, and Android Appetize launch.
