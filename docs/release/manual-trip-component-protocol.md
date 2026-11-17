# Manual Trip-Change Capture Diagnostic

This optional local mode reproduces only
`TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`.
It is not the full ordinary matrix, physical-device proof, or release acceptance.
It does not change screenshots, retry a test, extend the screenshot timeout, or
add a recurring CI device job. The ordinary CI runner remains unfiltered.

Build `scripts/qa/build-android-matrix-apks.mjs` before booting the disposable
Android 35 emulator. Its ordinary APKs and metadata must exist under
`android/app/build/outputs/matrix-apks/ordinary{,-test}`. Do not replace previously
retained build artifacts or reuse a phone containing test apps or accounts.

The owner of the disposable device must explicitly set:

```text
SGM_FOCUSED_UI_CASE=trip-change-components
SGM_COMPONENT_UI_APPROVAL=trip-change-capture-only
SGM_LOCAL_DISPOSABLE_EMULATOR=true
SGM_PAUSE_TEST_PHONE_STORE=true
SGM_BLOCK_TEST_PHONE_INSTALLS=true
SGM_TEST_PHONE_ADMIN_APPROVED=true
```

Use `prepareContinuousDevice` and retain its original receipt at the absolute
`SGM_PREINSTALLED_TEST_APKS_RECEIPT` path, with exclusive creation. The manual
mode pins only the ordinary app/test pair, validates APK metadata and actual
installed hashes, and activates the same installation guard before execution.
Do not set fake Linux or GitHub environment markers on another host.

Run `node scripts/qa/run-manual-trip-components.mjs`. The receipt is consumed
once. Original instrumentation, process status and parsed results are appended
beside it without overwrites. A process crash triggers a bounded Android runtime
crash-buffer diagnostic (Java and native entries) and a package-scoped Activity
Manager exit record before the original failure is rethrown. This distinguishes
an empty crash buffer from missing startup-exit evidence. Diagnostic failure
does not convert the test into a pass. No account credentials are required.

The device owner must call `restoreContinuousDevice` in a `finally` block,
retain its independent result, stop its owned emulator, and verify process exit.
Both ordinary packages are removed in test-before-app order; unrelated packages
are rejected. If restoration fails, retain the negative receipt. Disposing the
explicitly disposable virtual device is separate evidence, not successful
restoration. No personal or previously saved virtual-device data may be removed.
