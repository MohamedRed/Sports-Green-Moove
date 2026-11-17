# BrowserStack public-launch protocol attempt — 2026-06-20

Branch/commit: `codex/implement-plan` @ `e1b3f5c7cc61140f0ab8798b08ea8910e3b60266`

## Actions completed

- Installed GitHub repository secrets `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` from the Hermes BrowserStack credentials.
- Built the Android debug APK through the existing Android Appetize workflow:
  - Run: <https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27872101981>
  - APK artifact name: `sports-green-moove-debug-apk`
  - APK SHA-256: `05e70ccdf4695d2f89042e7402282343a0ad1656400f146919dd9716343f28a8`
  - APK size: `33633772` bytes
  - APK archive integrity: `unzip -t` passed
- Uploaded the verified Android APK to BrowserStack App Automate and installed the resulting `bs://...` value as GitHub secret `BROWSERSTACK_ANDROID_APP_URL`.
- Ran a BrowserStack Android real-device launch/auth smoke on Google Pixel 8 / Android 14.0:
  - BrowserStack session: `f9aa922f43b1b6bd17b69b8f24d1b9a8e2b9436e`
  - Dashboard: <https://app-automate.browserstack.com/builds/6a6aba1d0a878d9f8692b90e36e51df018725a55/sessions/f9aa922f43b1b6bd17b69b8f24d1b9a8e2b9436e>
  - Result: passed
  - Checks: package visible, SGM wordmark visible, login controls visible, empty-login validation shown, signup form visible, empty-signup validation shown.

## Full public-launch status

NO-GO / blocked. This smoke does **not** clear the full public-launch real-device protocol.

`node scripts/report-release-gaps.mjs --secret-inventory <github-secret-name-list> --json` still reports:

- Android real-device release runs: `0`
- iOS real-device release runs: `0`
- Android missing scenarios: `foreground_tracking`, `background_tracking`, `locked_screen_tracking`, `gps_loss`, `network_loss`, `app_restart`, `battery_saver`, `radar_webhook_delay`, `firebase_native_fallback`
- iOS missing scenarios: `foreground_tracking`, `background_tracking`, `locked_screen_tracking`, `gps_loss`, `network_loss`, `app_restart`, `battery_saver`, `radar_webhook_delay`, `firebase_native_fallback`
- Safety-audit evidence still missing: `guardian_consent_event`, `pickup_event`, `dropoff_event`, `radar_webhook_event`, `native_fallback_location_event`, `payment_reconciliation_event`

## Remaining hard blockers

1. `BROWSERSTACK_IOS_APP_URL` is not installed because no signed iOS `.ipa` artifact is available.
2. The repo currently has no signed real-device iOS IPA in the workspace, and the iOS Appetize workflow is a disabled simulator-build path, not a real-device IPA path.
3. GitHub secrets do not include Apple signing/provisioning material required to produce a signed IPA from CI.
4. The release manifest must not be updated to mark real-device scenarios as passed until actual Android and iOS scenario runs and a validated sanitized safety-audit export exist.
