# Android App

Kotlin + Jetpack Compose source scaffold for the Sports Green-mOOVe Android app.

## Minimum Target

- Minimum SDK 26
- Target latest available SDK at implementation time
- Compose UI
- Foreground location service for active ride tracking

## Firebase Slice

The app root now uses real Firebase providers when `android/app/google-services.json` is present:

- Firebase Auth: email/password login/signup, Google sign-in through Credential Manager, and Facebook sign-in through the native Meta Login SDK.
- Firestore: published trip reads.
- Cloud Functions: booking request, ride start, active ride snapshot.
- Stripe PaymentSheet config: booking-owned native payment setup through `createRidePaymentIntent`.
- Parent payments: approved unpaid bookings are listed in-app and launch Stripe PaymentSheet with server-priced intents.
- Radar SDK trip tracking: when `SGM_RADAR_PUBLISHABLE_KEY` is set, driver ride start calls Radar `startTrip` with the ride session as `externalId` and continuous tracking options.
- Native location fallback: fused location writes the first active-ride batch through `writeLocationBatch` and starts a foreground location service when Radar is not configured.
- Active-ride start is gated on precise foreground location, background location, and notifications before the foreground service starts.
- Google Maps route preview: active rides render the trip route in Maps Compose when `SGM_GOOGLE_MAPS_ANDROID_API_KEY` is set.

Without `google-services.json`, the app shows a configuration-required screen instead of silently using mock data.

Google sign-in requires the Firebase web client id generated into
`default_web_client_id` by the Google Services Gradle plugin. If that client id is
missing, tapping Google shows a configuration error instead of using a fallback
identity flow.

Facebook sign-in requires the Facebook provider to be enabled in Firebase Auth,
the Android package to be registered in Meta for Developers, and these Gradle
properties or environment variables before production builds:

```bash
SGM_FACEBOOK_APP_ID=123456789 \
SGM_FACEBOOK_CLIENT_TOKEN=client_token \
./gradlew :app:assembleDebug
```

## Stripe Slice

The app declares `com.stripe:stripe-android:23.10.0`. The backend returns the publishable key and PaymentIntent client secret from `createRidePaymentIntent`; the app must not store Stripe secret keys.

## Radar Slice

Set the Android Radar publishable key as either a Gradle property or environment variable named `SGM_RADAR_PUBLISHABLE_KEY` before production device builds:

```bash
SGM_RADAR_PUBLISHABLE_KEY=prj_live_or_test_key ./gradlew :app:assembleDebug
```

The key is compiled into Android resources as a publishable client key only. Radar secret keys and webhook secrets stay server-side in Firebase Functions.

## Google Maps Slice

Set the Android Google Maps SDK key as either a Gradle property or environment variable named `SGM_GOOGLE_MAPS_ANDROID_API_KEY` before production device builds that need route maps:

```bash
SGM_GOOGLE_MAPS_ANDROID_API_KEY=android_maps_key ./gradlew :app:assembleDebug
```

Store-review evidence is tracked in `../docs/release/store-readiness.md`.
