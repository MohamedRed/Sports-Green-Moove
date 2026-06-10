# Sports Green-mOOVe

Pure-native public-launch foundation for the Belgian sports and cultural carpooling app.

## Product Scope

- iOS SwiftUI app in `ios/`
- Android Kotlin + Jetpack Compose app in `android/`
- Firebase Cloud Functions and security rules in `functions/`
- Basic admin console in `admin/`
- Shared data/API contracts in `docs/contracts/`

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

Native projects are scaffolded as implementation-ready source trees. Add real Firebase, Radar, Google Maps, and Stripe app credentials before device builds.

## Design System

The visual source of truth is the local Codex skill:

`/Users/mrr/.codex/skills/sport-green-moove-design`

Shared raster assets copied into this repo live in `shared/assets/`.

