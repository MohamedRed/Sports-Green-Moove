# iOS App

SwiftUI source scaffold for the Sports Green-mOOVe iOS app.

## Minimum Target

- iOS 17+
- SwiftUI + Observation
- Core Location background capability required for active ride tracking

## Firebase Slice

The app root now uses real Firebase providers when `GoogleService-Info.plist` is present in `Sources/SportsGreenMooveApp/Resources`:

- Firebase Auth: email/password login/signup, Google sign-in through GoogleSignIn, and Facebook sign-in through FacebookLogin.
- Firestore: published trip reads.
- Cloud Functions: booking request, ride start, active ride snapshot.
- Stripe PaymentSheet config: booking-owned native payment setup through `createRidePaymentIntent`.
- Parent payments: approved unpaid bookings are listed in-app and launch Stripe PaymentSheet with server-priced intents.
- Radar SDK trip tracking: when `SGM_RADAR_PUBLISHABLE_KEY` is set at build time, driver ride start calls Radar `startTrip` with the ride session as `externalId` and continuous tracking options.
- Native location fallback: Core Location writes the first active-ride batch through `writeLocationBatch` when Radar is not configured.
- Google Maps route preview: active rides render the trip route in `GMSMapView` when `SGM_GOOGLE_MAPS_IOS_API_KEY` is set.
- `PrivacyInfo.xcprivacy`: bundled privacy manifest for linked account identity and precise active-ride location.

Without the plist, the app shows a configuration-required screen instead of silently using mock data.

Google sign-in requires `SGM_GOOGLE_REVERSED_CLIENT_ID` to match
`REVERSED_CLIENT_ID` from `GoogleService-Info.plist`; that value is expanded into
`Info.plist` as the URL scheme used by GoogleSignIn. Missing Google config is
reported in-app when the user taps Google.

Facebook sign-in requires the Facebook provider to be enabled in Firebase Auth,
the iOS bundle id to be registered in Meta for Developers, and these build
settings or environment variables before production builds:

```bash
SGM_FACEBOOK_APP_ID=123456789 \
SGM_FACEBOOK_CLIENT_TOKEN=client_token \
xcodebuild -scheme SportsGreenMoove -configuration Debug
```

## Google Maps Slice

`project.yml` declares Google Maps iOS SDK `10.14.0` through Swift Package Manager. Set the iOS Maps SDK key as an environment variable named `SGM_GOOGLE_MAPS_IOS_API_KEY` before production simulator or device builds:

```bash
SGM_GOOGLE_MAPS_IOS_API_KEY=ios_maps_key xcodebuild -scheme SportsGreenMoove -configuration Debug
```

The key is expanded into `Info.plist` as a client Maps SDK key only. Server-side Google Routes keys stay in Firebase Functions.

## Stripe Slice

`project.yml` declares Stripe iOS `25.17.0` with `StripePaymentSheet`. The backend returns the publishable key and PaymentIntent client secret from `createRidePaymentIntent`; the app must not store Stripe secret keys.

## Radar Slice

`project.yml` declares Radar iOS `3.34.0` with the `RadarSDK` product. Set the iOS Radar publishable key as an environment variable named `SGM_RADAR_PUBLISHABLE_KEY` before production simulator or device builds:

```bash
SGM_RADAR_PUBLISHABLE_KEY=prj_live_or_test_key xcodebuild -scheme SportsGreenMoove -configuration Debug
```

The key is expanded into `Info.plist` as a publishable client key only. Radar secret keys and webhook secrets stay server-side in Firebase Functions.

## Required iOS Capabilities

- Background Modes: Location updates
- Push Notifications
- Sign in with Apple can be added later if App Store review requires parity with other social login options
- Associated Domains if deep links are enabled

## Build Note

This folder contains the app source, Swift package scaffold, and XcodeGen project spec used by CI/Appetize.

Store-review evidence is tracked in `../docs/release/store-readiness.md`.
