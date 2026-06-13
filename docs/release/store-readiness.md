# Store Readiness

## Background Location And Child Safety

- Location sharing is limited to active ride sessions.
- Drivers must grant precise foreground location, background location, and notifications before Android starts active-ride tracking.
- iOS declares foreground and background location usage strings plus the location background mode in `ios/project.yml`.
- iOS bundles `PrivacyInfo.xcprivacy` for linked account identity and precise ride location used for app functionality.
- If a child has no device or permission is denied, the app must use vehicle tracking plus driver-confirmed pickup/dropoff status; it must not invent a child location.

## Review Evidence Required Before Public Launch

- Real-device iOS and Android locked-screen tracking run.
- GPS loss, network loss, app restart, and battery-saver tests.
- Guardian consent copy and audit events for child tracking.
- Privacy policy URLs for Firebase, Meta, Radar, Google Maps Platform, and Stripe Connect.
- Store screenshots showing active ride tracking, stale-location warning, emergency contact action, and permission education.
- Public privacy/data-safety answers stay aligned with `docs/release/privacy-data-safety.md`.
