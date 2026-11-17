# iPhone ride-request ownership, 4 November 2026

Local production-method checks with controlled gateways. No phone, live account,
real tracking provider, location request, payment or production write is involved.
Android and iPhone both remain required for release.

## Reproduced Failure

With the production ride/startup/authentication bodies at
`9936e6512889f3ab1cace4931513460951fef37b`, a held `startRide` response is released
after `AppState.signOut()`. The original code restores the ride and invokes both
tracking gateways. `baseline.txt` preserves the failed regression (exit 133).
The added synthetic gateway/probe tests compile against the unchanged production
bodies; this is not a historical full-app/SDK build.

The same sequence now retains no ride and makes only the already-issued
`start-ride` call. No following tracking call occurs. `native-checks.txt` preserves
the complete native-check command result, not just the new test's output.

## Changes

`RideRequestState` serializes ride work and binds its request generation to the
account and role. Sign-out, account change, role change or role revocation
invalidate it. Returning to the same account/role cannot revive an old request.
Unsettled work keeps its gate until it finishes; authentication cannot replace the
identity during that pending ride operation. No retry or new timeout is added.

Permission confirmation, driver/child startup, passenger writes, ride completion
and follow-up reads check ownership around their awaits. Stale success/error does
not update the ride, overlay, notices, errors or unrelated loading state. Signed-out
and unauthorized-role startup is denied before gateway work. Permission cleanup
resumes its pending location continuation once; it does not instantiate the system
coordinator merely to cancel it. A duplicate permission request is refused rather
than overwriting the original continuation.
The system permission coordinator also checks its own generation after each await,
so a revoked location response cannot advance into a later notification prompt.
This system-specific branch is source-checked, not executed by the local Mac test.

Revocation synchronously requests global native capture stop and local Radar stop,
clearing Radar user identity/metadata. The logout path does not call `endRide`,
`completeTrip` or `cancelTrip`. Delayed tracking startup repeats local stop when
cancelled. The exact-ride native stop is now synchronous on the main actor, not a
fire-and-forget task that could run after a replacement start. Location uploads
capture their initiating UID and use the existing owned callable boundary before
sending and after receiving. The upload is a separate short module and is included
in the strict controlled signature check.

Radar's documented logout stop and nullable identity/metadata declarations were
checked in the [official SDK guide](https://github.com/radarlabs/mintlify/blob/main/sdk/ios.mdx)
and [class reference](https://radarlabs.github.io/radar-sdk-ios/Classes/Radar.html).
These documents are API guidance, not runtime evidence that an actual device has
stopped. The counters here prove calls to controlled gateways only.

## Checks And Limits

The native matrix covers 72 held driver/child startup combinations: three await
boundaries, success/error, logout, another UID, same-UID reauthentication, role
round-trip, role removal and cancellation. Two permission and eight passenger/end
revocation cases pass. Duplicate pending startup is denied; a current failure
permits an explicit new attempt. Existing native suites still execute.

The first matrix draft fails to compile because the test put awaited values in a
synchronous autoclosure; the corrected test stores them first. Its next execution
finds that a cancelled upload throwing a different error does not call local stop.
The final cleanup tests both cancellation error and task cancellation. Both failed
receipts are retained separately; neither is described as a product-flow pass.
`signatures.txt` is a strict Swift 6 controlled-declaration typecheck, not an SDK
build. `source-sha256.json` binds the current source checked locally.

The profile logout button remains unwired. Full issued-transport drain,
UID/role-bound remaining ride backend methods, other screen controllers, persistent
provider trip state, SDK-linked/rendered logout, background/locked real movement,
operational notifications and safety audit receipts still need verification.
Already-issued requests are not withdrawn by these ownership checks. This work
does not accept complete sign-out, actual service teardown or release readiness.

Publish one brief local note only. Preserve all 34 flows, 532 media files, phone
dates, tours, blockers, partial statuses, previous updates and public audience.
