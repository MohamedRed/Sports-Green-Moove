# Native Parent Consent Replay

## Before Rendering Prerequisite Correction

Commit `f2f3eac92fa2b5a7db042adf416200bb97c46295`,
[Native CI 39034934597](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39034934597),
declared 102 ordinary cases: 81 passed, one failed, no errors and 20 conditional
local-backend skips. Both real-keyboard probes passed. The failure was
`TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying` at
`captureLocalUi`, with `Failed waiting for PixelCopy!`. Its original XML and
per-case log are retained in `before-renderer/`, with byte hashes.

The new [three-account consent case](../../../contracts/native-trip-consent-test.md)
was one of those conditional skips. The separate backend/native replay did not
start and no consent-stage result exists for this run. Compilation, configuration
checks and other passing screen cases do not establish that the new test ran.

The failing log reports the legacy Maps renderer. The configured image was
`google_apis` on API 35, not the Play Store image. Google's
[current renderer requirements](https://developers.google.com/maps/documentation/android-sdk/renderer)
include an enabled Play Store and Play services 21.39.14 or later. The supported
[`android-emulator-runner` target](https://github.com/ReactiveCircus/android-emulator-runner#configurations)
`google_apis_playstore` is available as API 35 x86_64 system-image revision 9 in the
vendor SDK inventory checked on 2026-10-17.

The workflow now selects that image on the same API, architecture and hardware
profile. The disposable preflight requires enabled Store/services and a parseable
active service version meeting the documented minimum before changing the
launcher or starting tests. It reports only sanitized eligibility fields. No
account login, renderer override, screenshot retry, longer capture wait, fake map,
provider substitute or production permission is added. The existing isolation,
capture assertions, actual keyboard, network cut and new three-account test stay
mandatory. Existing launcher isolation remains scoped to disposable tests without
home navigation; it is not evidence that device setup/SIM reliability is solved.

This corrects a renderer prerequisite, not proven causality for the PixelCopy
timeout. A new actual run must prove renderer behavior, captures and the complete
consent stage. Map visibility, time/address entry, application, payments, process
death, physical tracking and safety audits remain open. The goal stays active.

## First Play Store Image Attempt

Commit `5d7fd995e8cd738585f46a48a357a54778de0f6d`,
[Native CI 39036191921](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39036191921),
booted the new image and reached the prerequisite reader, but the full Play
services package dump exceeded the command-output buffer (`ENOBUFS`). No ordinary
screen or three-account test ran. Package presence checks preceded that failure;
the service version and actual renderer were not established by it.

The version query now filters only version-name and inactive-package-boundary
fields on the device, so unrelated package diagnostics never cross into the
Node buffer. A subprocess failure exposes only its code/status, not its attached
raw stdout/stderr. No buffer/wait increase, retry or test substitution is added.
Unit checks cover failure sanitization, the active package and version boundaries;
the next actual run must still establish the runtime result.

## Eligible Runtime Result

Commit `ff7d244edff67d360a4ec97f420f1387911a10b6`,
[Native CI 39036624494](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39036624494),
passed the device prerequisite check: Store/services enabled, active Play services
version `24.23.35`. `eligible-runtime/maps-runtime.json` is a labeled derived
projection of that exact CI log observation, not a new runtime or flow result.
The original XML and failing per-case log are retained alongside it.

The ordinary suite again had 102 declared cases: 81 passed, one failure, no errors
and 20 conditional skips. This time
`refusalKeepsTheInitialTripWithoutCancellingTheBooking` failed waiting for PixelCopy.
The failing log still reports the legacy Maps renderer. Renderer eligibility did
not establish a renderer upgrade or resolve the capture failure. No new map or
consent capture is approved, and the three-account case/full replay did not start.

The independent-required-suite runner change prevents this failure from silently
suppressing the other mandatory replay. It preserves a failed overall result if
either suite or component evidence fails, with separate status metadata. Eight
shell-harness regression cases verify those failure paths; they are not app-flow
evidence. The actual next run must still execute the native consent scenario.

## Replay Stopped Before Consent

Commit `77dc13605dba0568bd8790ca1a7c211593dcc5fa`,
[Native CI 39037894686](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39037894686),
completed the ordinary suite: 102 cases, 82 passed, no failures/errors and 20
conditional skips. Component evidence collection completed too. The saved
`native-suite-status.json` records statuses `0`, `0`, `1` for ordinary tests,
component evidence and the required local replay respectively. The overall job
correctly failed. Original XML, statuses and the failing transcript are retained
in `process-stopped/` with byte hashes.

Local replay `bb65bdbdac1d5bef056785c3ec627b38` reached
`LocalTripCancellationFlowTest`, then reported `shortMsg=Process crashed.` with
`INSTRUMENTATION_CODE: 0`. The verifier rejected this as not passing. Its crash
buffer was empty; these records do not establish whether a cancellation action,
application exception, native error or operating-system termination caused the
exit. The three-account consent case did not start. No consent-stage receipt or
new consent capture is accepted.

Reviewed component captures still contain incomplete map tiles, so they are not
added to the partner gallery. A passing screen assertion does not establish map
usability or a completed multi-account flow.

The next replay collects OS process-exit records, bounded filtered process logs
and guest/host memory diagnostics after a failed instrumentation result, even if
the Java crash buffer is empty. Passwords, API keys and signed/unsigned tokens are
redacted. Diagnostic failure never changes the original failed result, retries a
test or restarts the app. The next actual replay must establish the cause and run
the consent case before it can be accepted.

## First Executed Consent Attempt

Commit `27cfccf9ca6ca74da328a6f1bcf77402267745f4`,
[Native CI 39039936468](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39039936468),
again passed 82 ordinary cases with no failures/errors and 20 conditional skips.
Component collection passed; the required local replay failed. Its isolated run
was `435f5ded82dc9ae293252c1c5b3749a3`. Seven original records are retained with
hashes in `first-consent-attempt/`.

This replay passed `LocalTripCancellationFlowTest` and reached the new consent
case. That case proposed all three price changes through the driver account and
asserted the pending status with zero of two agreements for each. It then signed
in as the first parent and failed at the first `openReservation` call: the review
row existed but its control was disabled. No parent decision, withdrawal,
independent persisted consent verification or accepted consent-stage receipt was
completed. The native case failed after 27.376 seconds, rather than exhausting its
existing 60-second readiness budget.

`ReservationState.reload` publishes fetched rows before awaiting its `onChanged`
refresh and releasing `loading`. `ReservationManagementRoute` deliberately
disables those controls while loading or requiring reconciliation. The test had
waited only for row presence, then asserted enabled immediately. It now waits
within the unchanged 60-second budget for that exact control to be enabled,
requires no reservation error, then scrolls and makes the same single click.
There is no forced disabled action, semantics bypass, retry, longer deadline,
production behavior change or weakened outcome assertion. Compilation alone does
not prove this correction passes; an actual replay remains required.

All four new read-only diagnostic queries completed. The crash buffer is empty;
the exit records describe normal force-stops after finished instrumentation in
this run, not a reproduction or explanation of the earlier process crash. That
earlier reliability issue remains open.

## Native Interaction Passed, Host Verification Interrupted

Commit `6b1ad211d930b08cdbee74899877a7344b13953e`,
[Native CI 39041642112](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39041642112),
passed the ordinary suite (82 passed, no failures/errors, 20 conditional skips)
and component collection. Isolated replay `c54adf365a442d73d9ada2ff431ec247`
passed `LocalTripChangeFlowTest` in 45.783 seconds, including both parent
agreements, refusal without cancellation, withdrawal and the route-quote gate.
Its run-bound native receipt and four dialog captures were copied successfully.
Twelve original/excerpted records with byte hashes are retained in
`ui-passed-verification-interrupted/`; the host error file is an exact CI log
excerpt, not a full log or a fresh execution result.

The host verifier then failed on its first sign-in request with `fetch failed` /
`UND_ERR_SOCKET: other side closed`. It did not finish independent persisted-data
checks. There is no accepted `trip-change-ui-stage.json` or complete `results.json`.
The overall job remains failed (`0`, `0`, `1`), even though the native interaction
case passed. Later membership, restart and network stages were not executed.

The local host makes synchronous native subprocess calls between requests. Its
pooled HTTP socket can expire at the emulator while the host event loop is
blocked. A separate loopback HTTP fixture reproduces a closed-socket POST failure
after such a pause; depending on the OS it reports `ECONNRESET` or `UND_ERR_SOCKET`.
The retained two-case unit report proves that one-shot `Connection: close`
requests survive the same pause, preserve authorization, open distinct sockets
and do not retry a deliberately failed POST. External endpoints and redirects
are denied. Only the local QA HTTP client changes; real application connections,
backend semantics and evidence acceptance stay unchanged. The next actual replay
must still prove the independent verification succeeds.

The reviewed both-parent capture still shows a refresh in progress. The isolated
APK has no map key, so its captures say `Carte indisponible.`; they are not map
evidence or approved partner-gallery captures. Future consent captures wait for
the existing review busy marker to clear within the unchanged 60-second budget.
Earlier process crashes, rendering, physical-device use, applying changes and
real payments/refunds remain open.

The corrected HTTP client also passed a fresh 24-group isolated service replay,
`19f3301bcb5bfc84c313eca2a600aa1e`, on 2026-10-17 at 15:04:33 UTC. Its original
`http-service-recheck.json` is retained alongside the native records. This checks
the shared client against actual local handlers, including parent decisions and
application/payment boundaries with synthetic providers. It is a separate service
run, not the interrupted native run's missing persisted-data verification.
