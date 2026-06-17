# Android Verification Notes

## 2026-06-17

Branch: `codex/implement-plan`
Current PR source commit: `93c32718fd3f474c3087a4bff06091efe7fd2305`

Verified current PR gates:

- Native CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276422
  - Result: passed on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
  - Native UI flow coverage job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276422/job/81858894671
  - Android native unit test job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276422/job/81858894555
  - Android connected UI job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276422/job/81858894608
  - Android connected UI artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276422/artifacts/7691003841
- Backend CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276384
  - Result: passed on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
  - Functions, Firebase rules, and Stripe webhook emulator tests passed in job https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276384/job/81858894535
- Web Integration Smoke run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276441
  - Result: passed on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
  - Functions, admin, and website smoke job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276441/job/81858894552
- Release Readiness run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276374
  - Result: passed on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
  - Store readiness static checks job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678276374/job/81858894634
- Android Appetize run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678638781
  - Result: passed on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
  - Firebase Android config was installed from repository secrets.
  - APK artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678638781/artifacts/7691106327
  - Appetize upload completed in job https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27678638781/job/81860108058
- Production backend live smoke:
  - Result: passed.
  - Run id: `codex-smoke-2026-06-17T09-32-01-066Z-a85f7fea`.
  - Coverage: disposable auth/profile setup, trip publish, child-tracking search, booking approval, active ride, child native fallback, chat, ride completion, and rating.
- Production operations live smoke:
  - Result: passed.
  - Run id: `codex-ops-smoke-2026-06-17T09-32-01-066Z-c6dce78f`.
  - Coverage: disposable auth/profile setup, club membership request and reuse, support report creation, and admin review.

Notes:

- Android action-flow coverage now verifies publish draft creation, search, group join dispatch, booking approval, active ride pickup/drop-off/end, support report creation, rating submission, payments, Stripe Connect, and rewards withdrawal routing. Commit `93c32718fd3f474c3087a4bff06091efe7fd2305` also routes the rewards withdrawal CTA through the driver payments flow instead of leaving it as a no-op.
- The 2026-06-16 Appetize screenshots remain the latest checked-in interactive Android email/password screenshots. They were captured before the non-visual Android action-flow test coverage updates, but the current Android Appetize build/upload was re-run on commit `93c32718fd3f474c3087a4bff06091efe7fd2305`.
- Full public-launch evidence still requires physical Android real-device scenarios, store-review screenshots, and the safety-audit event trail listed below.

## 2026-06-16

Branch: `codex/implement-plan`
Android APK source commit: `2e2d8c75c644d964edbb710e3691169af8fdc939`

Verified Android and automated-flow gates:

- Native CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720
  - Result: passed.
  - Android connected UI job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720/job/81676718618
  - Coverage: 6/6 Android instrumentation tests passed on the GitHub-hosted emulator.
  - Artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27622972720/artifacts/7669295965
- Current PR Native CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27626426638
  - Result: passed on commit `2114029d076fde6a14665e6508b269d39aa24a8d`.
  - Native UI flow coverage job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27626426638/job/81689174991
  - Android connected UI job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27626426638/job/81689174828
  - Android connected UI artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27626426638/artifacts/7670823120
- Android Appetize run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27623663997
  - Result: passed.
  - Firebase Android config was installed from repository secrets.
  - APK artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27623663997/artifacts/7669565180
  - Appetize upload completed and the browser launch reached the native email/password login screen on Pixel 7 / Android 13.
  - Screenshot: `docs/release/evidence/appetize-android-login-2026-06-16.png`
- Android Appetize email/password login:
  - Result: passed.
  - Appetize native automation signed in with a disposable Firebase Auth parent account on Pixel 7 / Android 13.
  - Verified post-login native home screen contained `Accueil`, `Trajets`, `Messages`, and `Profil` navigation and did not show an auth error.
  - Run id: `codex-appetize-login-2026-06-16T14-34-15-317Z-05751972`.
  - Screenshot: `docs/release/evidence/appetize-android-email-login-2026-06-16.png`
- Production backend live smoke:
  - Result: passed.
  - Run id: `codex-smoke-2026-06-16T15-03-55-844Z-41174bcf`.
  - Coverage: disposable auth/profile setup, trip publish, child-tracking search, booking approval, active ride, child native fallback, chat, ride completion, and rating.
- Production operations live smoke:
  - Result: passed.
  - Run id: `codex-ops-smoke-2026-06-16T15-03-55-852Z-0e5b2363`.
  - Coverage: disposable auth/profile setup, club membership request and reuse, support report creation, and admin review.

Automated-flow evidence is captured in
`docs/release/evidence/automated-user-flow-evidence-2026-06-16.json`.

Remaining Android evidence needed before public launch:

- Run physical Android real-device background, locked-screen, GPS loss, network loss, app restart, battery-saver, Radar-delay, and Firebase native fallback evidence following `docs/release/real-device-test-protocol.md`.
- Capture store-review screenshots for active ride tracking, native Google Maps route preview, stale-location warning, emergency contact action, and permission education.
- Google and Meta OAuth end-to-end checks remain postponed; the Appetize evidence verifies Android email/password sign-in but not third-party OAuth.

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
