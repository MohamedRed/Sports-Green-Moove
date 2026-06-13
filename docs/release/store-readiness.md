# Store Readiness

## Background Location And Child Safety

- Location sharing is limited to active ride sessions.
- Drivers must grant precise foreground location, background location, and notifications before Android starts active-ride tracking.
- iOS declares foreground and background location usage strings plus the location background mode in `ios/project.yml`.
- iOS bundles `PrivacyInfo.xcprivacy` for linked account identity and precise ride location used for app functionality.
- If a child has no device or permission is denied, the app must use vehicle tracking plus driver-confirmed pickup/dropoff status; it must not invent a child location.
- Active rides use native Google Maps SDK route previews when client Maps API keys are configured; missing keys show a configuration-required state, not a fake map.
- Native UI flow identifiers for auth, groups, publish, search, booking, active ride, messages, rating, CO2, rewards, options, and payments are enforced by `npm run test:native-ui-coverage`.
- Android Compose UI tests and iOS XCUITests render the native plan flows with deterministic fixtures and run in Native CI; `npm run test:android-ui-build` compiles the Android test APK locally.

## Review Evidence Required Before Public Launch

- Real-device iOS and Android locked-screen tracking run.
- GPS loss, network loss, app restart, and battery-saver tests.
- Guardian consent copy and audit events for child tracking.
- Privacy policy URLs for Firebase, Meta, Radar, Google Maps Platform, and Stripe Connect.
- Store screenshots showing active ride tracking, Google Maps route preview, stale-location warning, emergency contact action, and permission education.
- Public privacy/data-safety answers stay aligned with `docs/release/privacy-data-safety.md`.
