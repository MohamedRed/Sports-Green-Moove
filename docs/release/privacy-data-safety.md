# Privacy And Data Safety

This file is the launch checklist source for App Store privacy nutrition labels,
Google Play Data safety, and public privacy-policy drafting.

## Data Categories

| Category | Examples | Purpose | Linked To User | Tracking |
| --- | --- | --- | --- | --- |
| Account identity | name, email, Firebase UID | authentication, support, role access | yes | no |
| Child and guardian records | child profile, guardian ids, team memberships | guardian consent, ride participation, safety | yes | no |
| Precise location | driver and child active-ride updates | active ride safety, ETA, stale-location warnings | yes | no |
| Payment data | Stripe customer/payment intent ids, connected account ids | ride payment, driver rewards, payout reconciliation | yes | no |
| Messages and reports | chat text, support reports, audit events | ride coordination, support review, safety audit | yes | no |
| Environmental metrics | distance, CO2 ledger, reward ledger | impact reporting and rewards | yes | no |

The app does not sell personal data and does not use location or child data for
advertising or third-party tracking.

## Active-Ride Location Policy

- Location collection starts only after an active ride session is started.
- Location collection stops when the ride ends.
- Background location is used only to keep vehicle or child-device tracking reliable during the active ride.
- If a child has no device or permission is denied, parent views use vehicle tracking plus driver pickup/dropoff confirmations.
- Live trip reads are limited to the driver, listed parent participants, listed child-device users, and admins.
- Native fallback location writes are accepted only from the active ride driver or listed child-device user.

## Guardian Consent

- A child ride requires guardian consent before matching or booking.
- Child-device tracking requires explicit guardian consent and platform permission.
- Guardians must be able to use vehicle-only tracking when child-device tracking is unavailable.
- Support/admin review must preserve audit evidence for pickup, dropoff, Radar events, and native fallback updates.

## Processors And Public URLs

| Processor | Purpose | Public URL |
| --- | --- | --- |
| Firebase | authentication, Firestore, Realtime Database, Cloud Functions, notifications | https://firebase.google.com/support/privacy |
| Radar | active ride trip tracking, geofences, arrivals | https://radar.com/privacy |
| Google Maps Platform | address search, route matrix, routes, ETA | https://policies.google.com/privacy |
| Stripe Connect | PaymentIntents, connected accounts, transfers, payouts | https://stripe.com/privacy |

## Store Answers

- Background location: yes, only during active ride sessions for safety tracking and ETA.
- Precise location: yes, linked to user, app functionality, not tracking.
- Financial information: processed by Stripe; app stores Stripe ids and ledger summaries, not raw card numbers.
- Children: child profiles and child-device location are used only with guardian consent for ride safety.
- Data deletion: account and child deletion must remove mutable profile records and preserve legally required payment/safety audit records.
