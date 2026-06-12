# iOS App

SwiftUI source scaffold for the Sports Green-mOOVe iOS app.

## Minimum Target

- iOS 17+
- SwiftUI + Observation
- Core Location background capability required for active ride tracking

## Firebase Slice

The app root now uses real Firebase providers when `GoogleService-Info.plist` is present in `Sources/SportsGreenMooveApp/Resources`:

- Firebase Auth: email/password login and signup.
- Firestore: published trip reads.
- Cloud Functions: booking request, ride start, active ride snapshot.
- Stripe PaymentSheet config: booking-owned native payment setup through `createRidePaymentIntent`.
- Native location fallback: Core Location writes the first active-ride batch through `writeLocationBatch` when Radar is not configured.
- `PrivacyInfo.xcprivacy`: bundled privacy manifest for linked account identity and precise active-ride location.

Without the plist, the app shows a configuration-required screen instead of silently using mock data.

## Remaining SDK Wiring Points

- `RadarTrackingGateway`
- `GoogleRoutesGateway`

## Stripe Slice

`project.yml` declares Stripe iOS `25.17.0` with `StripePaymentSheet`. The backend returns the publishable key and PaymentIntent client secret from `createRidePaymentIntent`; the app must not store Stripe secret keys.

## Required iOS Capabilities

- Background Modes: Location updates
- Push Notifications
- Sign in with Apple can be added later if App Store review requires parity with other social login options
- Associated Domains if deep links are enabled

## Build Note

This folder contains the app source, Swift package scaffold, and XcodeGen project spec used by CI/Appetize.

Store-review evidence is tracked in `../docs/release/store-readiness.md`.
