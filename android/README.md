# Android App

Kotlin + Jetpack Compose source scaffold for the Sports Green-mOOVe Android app.

## Minimum Target

- Minimum SDK 26
- Target latest available SDK at implementation time
- Compose UI
- Foreground location service for active ride tracking

## Firebase Slice

The app root now uses real Firebase providers when `android/app/google-services.json` is present:

- Firebase Auth: email/password login and signup.
- Firestore: published trip reads.
- Cloud Functions: booking request, ride start, active ride snapshot.
- Stripe PaymentSheet config: booking-owned native payment setup through `createRidePaymentIntent`.
- Parent payments: approved unpaid bookings are listed in-app and launch Stripe PaymentSheet with server-priced intents.
- Native location fallback: fused location writes the first active-ride batch through `writeLocationBatch` and starts a foreground location service when Radar is not configured.
- Active-ride start is gated on precise foreground location, background location, and notifications before the foreground service starts.

Without `google-services.json`, the app shows a configuration-required screen instead of silently using mock data.

## Stripe Slice

The app declares `com.stripe:stripe-android:23.10.0`. The backend returns the publishable key and PaymentIntent client secret from `createRidePaymentIntent`; the app must not store Stripe secret keys.

## Remaining SDK Wiring Points

Add Radar publishable key and Google Maps key before production device builds that need tracking or route maps. Store-review evidence is tracked in `../docs/release/store-readiness.md`.
