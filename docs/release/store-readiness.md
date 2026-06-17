# Store Readiness

## Background Location And Child Safety

- Location sharing is limited to active ride sessions.
- Drivers must grant precise foreground location, background location, and notifications before Android starts active-ride tracking.
- iOS declares foreground and background location usage strings plus the location background mode in `ios/project.yml`.
- iOS bundles `PrivacyInfo.xcprivacy` for linked account identity and precise ride location used for app functionality.
- If a child has no device or permission is denied, the app must use vehicle tracking plus driver-confirmed pickup/dropoff status; it must not invent a child location.
- Active rides use native Google Maps SDK route previews when client Maps API keys are configured; missing keys show a configuration-required state, not a fake map.
- Native UI flow identifiers for auth, groups, publish, search, booking, active ride, messages, rating, CO2, rewards, options, and payments are enforced by `npm run test:native-ui-coverage`.
- Android Compose UI tests and iOS XCUITests render the native plan flows with deterministic fixtures and run in Native CI; `npm run test:android-ui-build` compiles the Android test APK locally.
- Stripe webhook reconciliation for ride payments, immutable reward ledger entries, and connected-account readiness is enforced with the Firestore Emulator by `npm run test:stripe-webhook-flow`.
- After backend deployments, `npm run smoke:live-backend-flow` creates disposable production users and verifies the deployed email/password auth, profile, publish, search, booking approval, active ride, native location, chat, completion, and rating callables before cleaning up its own data.
- After operations/backend deployments, `npm run smoke:live-operations-flow` creates disposable production users and verifies the deployed club membership request plus support report/admin review callables before cleaning up its own data.

## Review Evidence Required Before Public Launch

- `docs/release/evidence-manifest.json` is an in-progress release evidence manifest created from `docs/release/evidence-manifest.example.json`. It must validate with `npm run validate:release-evidence -- docs/release/evidence-manifest.json` only after every provider, real-device, store-review, and safety-audit item is backed by final evidence.
- Run `npm run report:release-gaps` while closing evidence to see which public-launch proof is still missing.
- To include configured GitHub secret names without exposing secret values, run `gh secret list --repo MohamedRed/Sports-Green-Moove --json name,updatedAt > /tmp/sgm-github-secrets.json`, then `npm run report:release-gaps -- --secret-inventory /tmp/sgm-github-secrets.json`.
- Run `npm run verify:pr-user-flow-checks` after GitHub Actions settles to prove the required PR user-flow checks are green for the current pull request. This checks CI status only; it does not replace real-device release evidence.
- Production provider configuration must pass `npm run validate:provider-readiness` with production secrets in the environment.
- The manual Provider Readiness Probe workflow can validate production provider secrets independently before the real-device evidence manifest exists.
- The real release evidence manifest must cite successful automated user-flow evidence for Native CI, Android connected UI tests, production backend smoke, production operations smoke, Firebase rules, Stripe webhook reconciliation, and Android Appetize launch.
- Real-device tests must follow `docs/release/real-device-test-protocol.md`.
- Android build and connected-device verification notes are tracked in `docs/release/android-verification-notes.md`.
- The manual Release Evidence Gate workflow validates production provider configuration and the real manifest before public-launch approval; the checked-in example is accepted only by `npm run test:release-evidence-template`.
- Real-device iOS and Android locked-screen tracking run.
- GPS loss, network loss, app restart, and battery-saver tests.
- Radar webhook delay and Firebase native fallback evidence for iOS and Android active rides.
- Production configuration evidence for Firebase, Radar, Google Maps Platform, Stripe Connect, and Meta Facebook Login. Do not include secrets in the manifest.
- Guardian consent copy and audit events for child tracking.
- Privacy policy URLs for Firebase, Meta, Radar, Google Maps Platform, and Stripe Connect.
- Store screenshots showing active ride tracking, Google Maps route preview, stale-location warning, emergency contact action, and permission education. Android emulator screenshots also capture guardian-consent copy, child-safety disclosure, and data-processor summary copy in Native CI; final store submission still needs the complete evidence package.
- App Store privacy answers and Google Play Data safety answers are prepared in `docs/release/evidence/` from `docs/release/privacy-data-safety.md`.
- The hosted admin build now exposes a public `/privacy` route without Firebase admin auth, and `npm run test:privacy-policy-page` verifies the route content and responsive layout. The production URL `https://sports-green-moove-prod.web.app/privacy` still needs to be published and live-verified before final store submission.
- Public privacy/data-safety answers stay aligned with `docs/release/privacy-data-safety.md`.
- Safety-audit exports must be sanitized and validated with `npm run validate:safety-audit-export -- docs/release/evidence/safety-audit-export.json` before the manifest marks audit items accepted.
