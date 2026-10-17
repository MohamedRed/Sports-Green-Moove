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
