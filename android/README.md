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

Without `google-services.json`, the app shows a configuration-required screen instead of silently using mock data.

## Remaining SDK Wiring Points

Add Radar publishable key, Google Maps key, and Stripe publishable key before production device builds that need tracking, route maps, or PaymentSheet.
