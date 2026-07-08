# Android Verification Notes

## 2026-07-07

Branch: `codex/implement-plan`
Validated multi-device BrowserStack commit: `aae8a96`
Validated live-backend BrowserStack commit: `d4d9a05`
Validated baseline BrowserStack commit: `40606cc72f3cba8b78fb9199451c621c05fbd34e`

Verified BrowserStack Android workflow can be rerun against a selected device from `workflow_dispatch`:

- Commit: `81a915a` (`ci: allow BrowserStack Android device selection`).
- Default push run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28885160037> — passed on Google Pixel 8 / Android 14.0, BrowserStack build <https://app-automate.browserstack.com/dashboard/v2/builds/fd40ef6944120a0d28f9010760338b9b5a0d8343>, session `b063f38232ec6ed657d06afae1ad7558e9b6980b`, 20/20 test cases passed.
- Manual selected-device run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28885794850> — passed on Samsung Galaxy S23 / Android 13.0, BrowserStack build <https://app-automate.browserstack.com/dashboard/v2/builds/5a563f5ad1f0766b4d245e4260a01ad00e27f210>, session `d6fe7feed5d70cf0d8f796bc54b09cb2a8ca6fa4`, 20/20 test cases passed.
- Manual lower-OS run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28886961491> — passed on Google Pixel 6 / Android 12.0, BrowserStack build <https://app-automate.browserstack.com/dashboard/v2/builds/97e753a108bd028d29b3a0e6089d7d2fd3072c52>, session `13c55e4117860989a557fea0e0bc5c21a87a947d`, 20/20 test cases passed.
- Manual older-OS run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28945531158> — passed on Samsung Galaxy S20 / Android 10.0, BrowserStack build <https://app-automate.browserstack.com/dashboard/v2/builds/8feead26c9cbeca66fe426c5d55ab313f2276d70>, session `711962681af124a50f435da37c368c09388ff31a`, 20/20 test cases passed.
- Home dashboard action run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28947098488> — passed on Google Pixel 8 / Android 14.0 after adding deterministic Home dashboard action coverage, BrowserStack build <https://app-automate.browserstack.com/dashboard/v2/builds/54ee729c9474011f2924e74e8111e44d85cac81c>, session `1749ff8e76fd37b7ea096e2f91c58239b6f9b82f`, 21/21 test cases passed.
- BrowserStack device inventory run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28939295650> — listed available Android targets before selecting the Android 10 run.
- Exploratory Samsung Galaxy Note 9 / Android 8.1 run <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28939351402> timed out while BrowserStack still reported the session as running; no app assertion failure was observed.
- Samsung APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28885794850/artifacts/8146163405>.
- Samsung BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28885794850/artifacts/8146310642>.
- Pixel 6 APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28886961491/artifacts/8146672972>.
- Pixel 6 BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28886961491/artifacts/8146819390>.
- Galaxy S20 APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28945531158/artifacts/8169515529>.
- Galaxy S20 BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28945531158/artifacts/8169689651>.
- Home dashboard APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28947098488/artifacts/8170176802>.
- Home dashboard BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28947098488/artifacts/8170468057>.
- Current PR checks on `aae8a96` also passed: Native CI, Backend CI, Web Integration Smoke, and Release Readiness.

Verified BrowserStack Android real-device live-backend signup and authenticated navigation smoke:

- Workflow: `Android BrowserStack Real-Device UI`
- Run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28883797383>
- Result: passed.
- Device: Google Pixel 8 / Android 14.0.
- BrowserStack build: <https://app-automate.browserstack.com/dashboard/v2/builds/3b64368d32a25b3c8205d76693fca15f3d2a6464>
- BrowserStack session: `cf2203ba945cab4dedd5082016640746bb4488b8`.
- APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28883797383/artifacts/8145328865>
- BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28883797383/artifacts/8145519415>
- Coverage: 20/20 Android instrumentation test cases passed with 0 failures, 0 skipped, 0 timed out, and 0 errors.
- New live-backend coverage: BrowserStack real device completed disposable email/password signup against the configured Firebase Android backend, called profile initialization, reached the authenticated home screen, and verified authenticated navigation to Trips (`MES TRAJETS`), Publish (`PUBLIER UN TRAJET`), Messages, and Profile (`MON PROFIL`).
- Earlier live-backend run `28882411226` also passed against BrowserStack build `aef441d4f5e207e209139702bc166c16b5d635d2`.
- Current PR checks on `d4d9a05` also passed: Native CI, Backend CI, Web Integration Smoke, and Release Readiness.

Verified BrowserStack Android real-device automation baseline:

- Workflow: `Android BrowserStack Real-Device UI`
- Run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880297958>
- Result: passed.
- Device: Google Pixel 8 / Android 14.0.
- BrowserStack build: <https://app-automate.browserstack.com/dashboard/v2/builds/73149a459755bd0047dd3d1a3c4c7a5508e273bf>
- BrowserStack session: `0106a479283458927ccdc1d521189fa8fe713421`.
- APK artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880297958/artifacts/8143856112>
- BrowserStack result artifact: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880297958/artifacts/8144043029>
- Coverage: 19/19 Android instrumentation test cases passed with 0 failures, 0 skipped, 0 timed out, and 0 errors.
- Validated flow surfaces include auth, publish, search, booking request/approval, active ride pickup/drop-off/end, emergency contact, groups, impact, rewards, support report, payments, Stripe Connect routing, messages, rating, bottom navigation, profile role filtering, and store-review screenshot states.

Also verified current PR checks on the same commit:

- Native CI: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880302423> — passed.
- Backend CI: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880302149> — passed.
- Web Integration Smoke: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880302055> — passed.
- Release Readiness: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/28880302326> — passed.

Notes:

- This closes the repeatable Android BrowserStack Compose UI automation gap for the current release branch.
- It does not by itself clear the full public-launch real-device protocol. The GPS/background/locked-screen/network-loss/battery-saver/Radar-delay/Firebase-native-fallback scenarios and sanitized safety-audit export still need dedicated release evidence before public launch can be marked complete.

## 2026-06-17

Branch: `codex/implement-plan`
Current PR head: `d3af12587f0b317cb278842f2440768ef3feb179`
Validated Android app-source commit: `b915bfaf16a0360fb866d8354b991c05464ed930`

Verified current PR gates:

- Native CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313522
  - Result: passed on PR head `d3af12587f0b317cb278842f2440768ef3feb179`.
  - Native UI flow coverage job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313522/job/81920341272
  - Android native unit test job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313522/job/81920341198
  - Android connected UI job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313522/job/81920341281
  - Android connected UI artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313522/artifacts/7698515393
  - Connected UI result: 18/18 instrumentation tests passed with 0 failures and 0 skipped tests.
  - Store-review screenshot artifact files:
    - `store-active-ride-tracking.png`
    - `store-child-safety-disclosure.png`
    - `store-emergency-contact-action.png`
    - `store-google-maps-route-preview.png`
    - `store-guardian-consent-copy.png`
    - `store-permission-education.png`
    - `store-privacy-summary.png`
    - `store-stale-location-warning.png`
- Backend CI run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696310106
  - Result: passed on PR head `d3af12587f0b317cb278842f2440768ef3feb179`.
  - Functions, Firebase rules, and Stripe webhook emulator tests passed in job https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696310106/job/81920332186
- Web Integration Smoke run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313473
  - Result: passed on PR head `d3af12587f0b317cb278842f2440768ef3feb179`.
  - Functions, admin, and website smoke job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696313473/job/81920344624
- Release Readiness run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696310877
  - Result: passed on PR head `d3af12587f0b317cb278842f2440768ef3feb179`.
  - Store readiness static checks job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27696310877/job/81920333308
- Android Appetize run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27695263025
  - Result: passed on validated Android app-source commit `b915bfaf16a0360fb866d8354b991c05464ed930`.
  - Firebase Android config was installed from repository secrets.
  - APK artifact: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27695263025/artifacts/7698026495
  - Appetize upload completed in job https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27695263025/job/81916650250
- Android Appetize email/password signup:
  - Result: passed.
  - Appetize native automation signed up with a disposable Firebase Auth parent account on Pixel 7 / Android 13.
  - Verified post-auth native home screen contained `Accueil`, `Trajets`, `Messages`, and `Profil` navigation and did not show an auth error.
  - Run id: `codex-appetize-2026-06-17T14-44-53-197Z-5ccd9bac`.
  - Screenshot: `docs/release/evidence/appetize-android-email-signup-2026-06-17.png`
- Production backend live smoke:
  - Result: passed.
  - Run id: `codex-smoke-2026-06-17T22-09-51-162Z-373f27f6`.
  - Coverage: disposable auth/profile setup, trip publish, child-tracking search, booking approval, active ride, child native fallback, chat, ride completion, and rating.
- Production operations live smoke:
  - Result: passed.
  - Run id: `codex-ops-smoke-2026-06-17T22-11-41-606Z-029cf779`.
  - Coverage: disposable auth/profile setup, club membership request and reuse, support report creation, and admin review.

Notes:

- Android action-flow coverage now verifies publish draft creation, search, group join dispatch, booking approval, active ride pickup/drop-off/end, support report creation, rating submission, payments, Stripe Connect, and rewards withdrawal routing. Commit `93c32718fd3f474c3087a4bff06091efe7fd2305` also routes the rewards withdrawal CTA through the driver payments flow instead of leaving it as a no-op.
- Commit `faa1abdb1ee8b89f2c8fd1cbbf305e3ecd4cd61b` adds repeatable Android store-review screenshot capture to Native CI, and run `27696313522` validates that all eight screenshot PNGs are present and non-empty after the emulator run.
- The 2026-06-17 Appetize screenshot refresh verifies the current uploaded Android build can complete the native email/password signup path and reach the home screen in Appetize on Pixel 7 / Android 13.
- Full public-launch evidence still requires physical Android real-device scenarios and the safety-audit event trail listed below. Store-review screenshots are now generated by Native CI, but the final store-submission evidence manifest still needs those artifacts attached to the release package.

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
- Google and Meta OAuth end-to-end checks remain postponed; the Appetize evidence verifies Android email/password auth but not third-party OAuth.

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
