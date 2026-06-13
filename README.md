# Sports Green-mOOVe

Pure-native public-launch foundation for the Belgian sports and cultural carpooling app.

## Product Scope

- iOS SwiftUI app in `ios/`
- Android Kotlin + Jetpack Compose app in `android/`
- Firebase Cloud Functions and security rules in `functions/`
- Basic admin console in `admin/`
- Shared data/API contracts in `docs/contracts/`
- Store review and privacy readiness notes in `docs/release/`

## Platform Roles

One account can hold multiple roles:

- `parent`: manages children, bookings, consent, and live ride views.
- `driver`: publishes rides, approves passengers, and streams vehicle location during active rides.
- `child`: optional child-device mode that streams location only during active rides with guardian consent.
- `clubManager`: manages club/team membership and moderation.
- `admin`: support and operational console access.

## Providers

- Firebase is the source of truth for durable app state.
- Realtime Database stores active ride location snapshots.
- Radar handles mobile tracking, trip tracking, geofences, arrival detection, and webhooks.
- Google Maps Platform handles Places, route matrix, final routing, and detour scoring.
- Stripe Connect Accounts v2 handles driver onboarding, ride payments, and payouts.

## Local Setup

1. Install Node 22+.
2. Install Firebase CLI if you want to run emulators.
3. Configure environment files from the examples in each package.
4. Run backend checks:

```sh
cd functions
npm install
npm test
npm run build
```

5. Run admin checks:

```sh
cd admin
npm install
npm run build
```

6. Run native plan checks:

```sh
npm run test:android-native
npm run test:android-ui-build
npm run test:ios-native
npm run test:native-ui-coverage
npm run test:release-evidence-template
```

Run `npm run test:android-ui` on an emulator or CI runner to execute the Android Compose UI tests for the native flow selectors. Native CI also generates the Xcode project and runs the iOS XCUITest flow suite on a simulator.

Native projects now include the first real Firebase vertical slice: email/password Auth, Google Auth, Facebook Auth, Firestore trip reads, booking requests, inbox reads, payments, native Google Maps active-ride route previews, and ride-session start/read through Cloud Functions. Add Firebase app credentials before device builds that need live data:

- iOS local/CI: `GoogleService-Info.plist`
- Android local/CI: `android/app/google-services.json`
- GitHub Actions: set `FIREBASE_IOS_CONFIG_BASE64` and/or `FIREBASE_ANDROID_CONFIG_BASE64`
- iOS Google Auth: set `SGM_GOOGLE_REVERSED_CLIENT_ID` to the reversed client id from `GoogleService-Info.plist`
- Facebook Auth: enable the Facebook provider in Firebase Auth, register the bundle/package identifiers in Meta for Developers, and set `SGM_FACEBOOK_APP_ID` plus `SGM_FACEBOOK_CLIENT_TOKEN`
- Google Maps route previews: set `SGM_GOOGLE_MAPS_ANDROID_API_KEY` and `SGM_GOOGLE_MAPS_IOS_API_KEY`

Provider production keys, simulator/device UI automation runs, and real-device release evidence remain required before production release. Native store-readiness evidence is tracked in `docs/release/store-readiness.md`. Public-launch approval requires a real manifest derived from `docs/release/evidence-manifest.example.json`:

```sh
npm run validate:release-evidence -- docs/release/evidence-manifest.json
```

## Design System

The visual source of truth is the local Codex skill:

`/Users/mrr/.codex/skills/sport-green-moove-design`

Shared raster assets copied into this repo live in `shared/assets/`.
