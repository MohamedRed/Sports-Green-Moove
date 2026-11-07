# Google Play Data Safety Answers

Source of truth: `docs/release/privacy-data-safety.md`.

These answers are prepared for the Google Play Console Data safety section. Google Play requires disclosure of collected or shared user data, encryption in transit, and whether users can request data deletion.

Official reference: https://support.google.com/googleplay/android-developer/answer/10787469

## Data Collection And Sharing

- Does the app collect or share any required user data types? Yes.
- Is all collected user data encrypted in transit? Yes.
- Can users request that their data is deleted? Yes.
- Is any collected user data used for advertising or third-party tracking? No.
- Does the app sell personal data? No.

## Collected Data Types

| Google Play data type | Collected | Shared | Purpose |
| --- | --- | --- | --- |
| Personal info - Name | Yes | No | Account management, role access, support. |
| Personal info - Email address | Yes | No | Authentication, account management, support. |
| App activity - In-app messages | Yes | No | Ride coordination chat and support reports. |
| App info and performance - Diagnostics | No | No | Not collected in v1 release scope. |
| Location - Precise location | Yes | No | Active-ride driver and child-device tracking, ETA, stale-location warnings, route safety. |
| Financial info - Payment info | Yes | Yes | Stripe ride payment, connected-account onboarding, payout reconciliation. |
| User IDs | Yes | No | Firebase UID, role access, ride participation, safety audit. |
| Other user-generated content | Yes | No | Support reports, audit events, ratings, ride coordination notes. |

## Security Practices

- Data is encrypted in transit by Firebase, Radar, Google Maps Platform, Stripe Connect, and Meta/Facebook Login transport.
- Mutable account and child records must be deleted when deletion is requested.
- Legally required payment, payout, and safety audit records are preserved only as required for reconciliation, safety, support, and compliance.

## Child Safety And Active-Ride Location

- Child profile and child-device tracking data are used only with guardian consent for ride safety.
- Background location is limited to active ride sessions.
- Tracking starts only after an active ride starts and stops when the ride ends.
- If a child has no device or permissions are denied, parent views use vehicle tracking plus driver pickup/dropoff confirmations.

## Third-Party Partners Covered

| Partner | Purpose | Public privacy URL |
| --- | --- | --- |
| Firebase | Authentication, Firestore, Realtime Database, Cloud Functions, notifications | https://firebase.google.com/support/privacy |
| Meta | Facebook Login identity provider | https://www.facebook.com/privacy/policy/ |
| Radar | Active ride trip tracking, geofences, arrivals | https://radar.com/privacy |
| Google Maps Platform | Address search, route matrix, routes, ETA | https://policies.google.com/privacy |
| Stripe Connect | PaymentIntents, connected accounts, transfers, payouts | https://stripe.com/privacy |
