# iOS App

SwiftUI source scaffold for the Sports Green-mOOVe iOS app.

## Minimum Target

- iOS 17+
- SwiftUI + Observation
- Core Location background capability required for active ride tracking

## SDK Wiring Points

The current source defines native service protocols and mock implementations:

- `FirebaseGateway`
- `RadarTrackingGateway`
- `GoogleRoutesGateway`
- `StripePaymentsGateway`

Replace the mock gateways with real SDK implementations after Firebase, Radar, Google Maps, and Stripe environment keys are available.

## Required iOS Capabilities

- Background Modes: Location updates
- Push Notifications
- Sign in with Apple can be added later if App Store review requires parity with other social login options
- Associated Domains if deep links are enabled

## Build Note

This folder contains the app source and Swift package scaffold. For a production App Store build, create an Xcode app target that includes `Sources/SportsGreenMooveApp` and the provider SDK packages.

