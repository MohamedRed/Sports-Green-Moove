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
