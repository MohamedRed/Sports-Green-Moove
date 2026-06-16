# Android Verification Notes

## 2026-06-16

Branch: `codex/implement-plan`
Commit: `2e2d8c75c644d964edbb710e3691169af8fdc939`

Verified Android and automated-flow gates:

- Native CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720
  - Result: passed.
  - Android connected UI job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720/job/81676718618
  - Coverage: 6/6 Android instrumentation tests passed on the GitHub-hosted emulator.
  - Artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720/artifacts/7669295965
- Android Appetize run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27623663997
  - Result: passed.
  - Firebase Android config was installed from repository secrets.
  - APK artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27623663997/artifacts/7669565180
  - Appetize upload completed and the browser launch reached the native email/password login screen on Pixel 7 / Android 13.
  - Screenshot: `docs/release/evidence/appetize-android-login-2026-06-16.png`
- Production backend live smoke:
  - Result: passed.
  - Run id: `codex-smoke-2026-06-16T14-08-14-205Z-a1a301b9`.
  - Coverage: disposable auth/profile setup, trip publish, child-tracking search, booking approval, active ride, child native fallback, chat, ride completion, and rating.
- Production operations live smoke:
  - Result: passed.
  - Run id: `codex-ops-smoke-2026-06-16T14-08-14-203Z-94ac4ae7`.
  - Coverage: disposable auth/profile setup, club membership request and reuse, support report creation, and admin review.

Automated-flow evidence is captured in
`docs/release/evidence/automated-user-flow-evidence-2026-06-16.json`.

Remaining Android evidence needed before public launch:

- Run physical Android real-device background, locked-screen, GPS loss, network loss, app restart, battery-saver, Radar-delay, and Firebase native fallback evidence following `docs/release/real-device-test-protocol.md`.
- Capture store-review screenshots for active ride tracking, native Google Maps route preview, stale-location warning, emergency contact action, and permission education.
- Google and Meta OAuth end-to-end checks remain postponed; the Appetize evidence only verifies the current Android build reaches the native login screen.

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
