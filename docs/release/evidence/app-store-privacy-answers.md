# App Store Privacy Answers

Source of truth: `docs/release/privacy-data-safety.md`.

These answers are prepared for App Store Connect app privacy details. Apple requires privacy details to include data collected by the app and by integrated third-party partners.

Official reference: https://developer.apple.com/app-store/app-privacy-details/

## Tracking

- Data used to track users: No.
- SPORTS GREEN-mOOVe does not sell personal data.
- SPORTS GREEN-mOOVe does not use location, child, payment, messages, reports, impact, or reward data for advertising or third-party tracking.

## Data Linked To The User

| App Store data type | Collected | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact Info - Name | Yes | Yes | App functionality, account management, support. |
| Contact Info - Email Address | Yes | Yes | Authentication, account management, support. |
| User ID | Yes | Yes | Firebase UID, role access, support, safety audit. |
| Location - Precise Location | Yes | Yes | Active-ride vehicle and child-device tracking, ETA, stale-location warnings, route safety. |
| Financial Info - Payment Info | Yes | Yes | Stripe PaymentIntents, connected accounts, ride payment, rewards and payout reconciliation. |
| User Content - Emails or Text Messages | Yes | Yes | Ride coordination chat, support reports, admin review. |
| Identifiers - User ID | Yes | Yes | Authentication, ride participation, audit trails. |
| Other Data | Yes | Yes | CO2 ledger, reward ledger, audit events, club/team membership state. |

## Data Not Collected For Tracking

- Account identity is used only for authentication, role access, and support.
- Child and guardian records are used only for guardian consent, ride participation, and safety.
- Precise location starts only after an active ride session starts and stops when the ride ends.
- Payment data is processed by Stripe; the app stores Stripe ids and ledger summaries, not raw card numbers.
- Messages, reports, and audit events are used for ride coordination, support review, and safety audit.
- Environmental metrics are used for impact reporting and rewards.

## Third-Party Partners Covered

| Partner | Purpose |
| --- | --- |
| Firebase | Authentication, Firestore, Realtime Database, Cloud Functions, notifications. |
| Meta | Facebook Login identity provider. |
| Radar | Active ride trip tracking, geofences, arrivals. |
| Google Maps Platform | Address search, route matrix, routes, ETA. |
| Stripe Connect | PaymentIntents, connected accounts, transfers, payouts. |

## Child Safety And Consent

- Child rides require guardian consent before matching or booking.
- Child-device tracking requires guardian consent and platform permission.
- If child-device tracking is unavailable, the app uses vehicle tracking plus driver pickup/dropoff confirmations.
- Support/admin review preserves safety audit evidence for pickup, dropoff, Radar events, native fallback updates, and payment reconciliation.
