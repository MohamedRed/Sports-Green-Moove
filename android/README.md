# Android App

Kotlin + Jetpack Compose source scaffold for the Sports Green-mOOVe Android app.

## Minimum Target

- Minimum SDK 26
- Target latest available SDK at implementation time
- Compose UI
- Foreground location service for active ride tracking

## SDK Wiring Points

The current source includes service boundaries for:

- Firebase Auth, Firestore, Realtime Database, FCM
- Radar trip tracking
- Google Maps Platform and Routes API
- Stripe PaymentSheet

Add real `google-services.json`, Radar publishable key, Google Maps key, and Stripe publishable key before device builds.

