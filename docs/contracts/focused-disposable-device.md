# Independent Focused Android Devices

Approved on 2026-10-19: one fresh disposable emulator per focused safety trial,
with our app and instrumentation installed before blocking installations. This
does not authorize changing personal devices, production data or provider plans.

The focused workflow runs six independent matrix jobs with fail-fast disabled:
recreated child contact, parent observation, native startup, remote completion
failed session restoration with rotation and explicit retry, and explicit
disconnect after a restoration failure across a stopped/new app process.
The existing required `Isolated safety flows` check succeeds only when every
case, including its cleanup, succeeds. Missing, cancelled and failed cases fail
that gate. The ordinary full native suite remains separate and unchanged.

## Continuous Guard

Preparation requires the four explicit disposable-device approvals, Android 15,
user 0, no existing test apps or administrator, no installation restriction and
no active installation. It snapshots the enabled map runtime, location, store
background modes and stopped state. It installs our temporary administrator and
both local-profile APKs, compares the installed APK bytes with their compiled
SHA-256 values, then activates the installation restriction.

The system can start a store service even after force-stop. The new focused
method therefore uses the continuous installation restriction as its invariant,
not a stopped-process observation. It retains that observation without claiming
that no store process ran or identifying why it restarted. The earlier
restricted-store method and its stopped-state assertion remain intact for the
ordinary suite; the new method is not a retry or fallback from failed setup.

The focused runner passes one absolute preparation receipt into the isolated
runtime. Pinned preparation requires that exact case, device, administrator,
guard, maps, location and both installed APK hashes. A one-use claim prevents
receipt reuse. Only our disposable app data is cleared. The app is not rebuilt,
uninstalled or reinstalled at this stage; no installation window is opened.
Missing or mismatched prerequisites fail before instrumentation.

## Cleanup And Evidence

Each host retains its original instrumentation predicates, native result marker,
sanitized captures and fixture checks. Successful reports include the preparation
receipt digest and APK hashes; those are preparation observations, not flow proof.
The new lifecycle source files are bound into each report's source hashes.

Hosts uninstall both local apps after execution, verifying their absence. The
outer exit trap independently verifies the guard, map runtime and location,
attempts own-package removal again, restores background and stopped state,
re-enables the launcher, and removes the temporary administrator and its package.
Every cleanup step is attempted even after another fails. Trial failures retain
priority; cleanup failure also fails an otherwise passing trial. Partial setup
performs its own independent rollback before returning a typed negative receipt.

Neither host process exit zero nor a valid preparation receipt accepts a user
flow by itself. Native test markers and disposal must be checked separately.
These emulators do not prove physical GPS, child sign-in, real payments or
production release readiness.
