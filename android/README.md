# Android App

Kotlin + Jetpack Compose source scaffold for the Sports Green-mOOVe Android app.

## Minimum Target

- Minimum SDK 26
- Target latest available SDK at implementation time
- Compose UI
- Foreground location service for active ride tracking

## Firebase Slice

The app root now uses real Firebase providers when `android/app/google-services.json` is present:

- Firebase Auth: email/password login/signup and Google sign-in through Credential Manager.
- Firestore: published trip reads.
- Cloud Functions: booking request, ride start, active ride snapshot.
- Stripe PaymentSheet config: booking-owned native payment setup through `createRidePaymentIntent`.
- Parent payments: approved unpaid bookings are listed in-app and launch Stripe PaymentSheet with server-priced intents.
- Radar SDK trip tracking: when `SGM_RADAR_PUBLISHABLE_KEY` is set, driver ride start calls Radar `startTrip` with the ride session as `externalId` and continuous tracking options.
- Native location fallback: fused location writes the first active-ride batch through `writeLocationBatch` and starts a foreground location service when Radar is not configured.
- Active-ride start is gated on precise foreground location, background location, and notifications before the foreground service starts.

Without `google-services.json`, the app shows a configuration-required screen instead of silently using mock data.

Google sign-in requires the Firebase web client id generated into
`default_web_client_id` by the Google Services Gradle plugin. If that client id is
missing, tapping Google shows a configuration error instead of using a fallback
identity flow.

## Stripe Slice

The app declares `com.stripe:stripe-android:23.10.0`. The backend returns the publishable key and PaymentIntent client secret from `createRidePaymentIntent`; the app must not store Stripe secret keys.

## Radar Slice

Set the Android Radar publishable key as either a Gradle property or environment variable named `SGM_RADAR_PUBLISHABLE_KEY` before production device builds:

```bash
SGM_RADAR_PUBLISHABLE_KEY=prj_live_or_test_key ./gradlew :app:assembleDebug
```

The key is compiled into Android resources as a publishable client key only. Radar secret keys and webhook secrets stay server-side in Firebase Functions.

## Remaining SDK Wiring Points

Add Facebook Auth SDK/app identifiers and the Google Maps key before production
device builds that need social login parity and route maps. Store-review evidence
is tracked in `../docs/release/store-readiness.md`.
