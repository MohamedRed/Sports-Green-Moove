# Android Verification Notes

## 2026-06-15

Branch: `codex/implement-plan`

Verified Android-only gates:

- `npm run test:native-ui-coverage`
  - Result: passed.
  - Coverage: 31 native UI flow identifiers across Android and iOS source references.
- `npm run test:android-native`
  - Result: passed.
  - Gradle task: `:app:testDebugUnitTest`.
- `npm run test:android-ui-build`
  - Result: passed.
  - Gradle task: `:app:assembleDebugAndroidTest`.

Connected-device status:

- `adb devices` returned no attached devices, so `npm run test:android-ui` could not be run locally.
- The Appetize Android URL redirected to Appetize login in a fresh browser session, so native Appetize UI testing still requires an authenticated Appetize browser session.
- `.github/workflows/native-ci.yml` now exposes manual dispatch for GitHub-hosted Android UI verification and uploads `android-connected-ui-test-results` from `connectedDebugAndroidTest`.

Remaining Android evidence needed before public launch:

- Run `npm run test:android-ui` on a connected emulator or physical Android device, or run `Native CI` on GitHub and retain the `android-connected-ui-test-results` artifact.
- Capture real-device background, locked-screen, GPS loss, network loss, app restart, battery-saver, Radar-delay, and Firebase native fallback evidence following `docs/release/real-device-test-protocol.md`.
