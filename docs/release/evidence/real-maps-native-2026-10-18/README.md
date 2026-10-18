# Native Real-Map Replay

## First Attempt: Incomplete

Source `b9d9609bd6405e9c677971f01a18cc8d1cff8174`, explicitly dispatched Native CI
[39112528954](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39112528954),
artifact `12130962314` (140,854 bytes). Original output and its SHA-256 manifest
are retained in `first-attempt/`.

The actual app selected and resolved the two public stations, using four real
Google Places requests, all HTTP 200. The reviewed original screenshot shows
Gare de Wavre and Gare de Louvain-la-Neuve with their returned addresses and
coordinates, on an isolated free trip with two parent bookings. It is evidence
of address selection, not of applying the route.

The test submitted the proposal and pressed the first parent's acceptance.
Its status wait incorrectly accepted the unchanged pending status before the
reply was rendered, then expected `1 / 2` while the UI still showed `0 / 2`.
The retained transcript records this exact assertion failure. The failed attempt
has no successful result or verification receipt, no route-computation request,
and no application screenshot. It must not be reported as a confirmed or applied
native route change. No charge, refund or production data write occurred.

Device cleanup verified and restored the store background policy with Maps and
location enabled at the unchanged service version `24.23.35`. This does not
convert the failed instrumentation into a pass.

The synchronization repair waits for the recorded decision message and completed
busy state before inspecting the count. A gated-response component regression
retains `0 / 2` and the same pending status before releasing the reply, then
requires the actual recorded agreement and `1 / 2`. No app behavior, timeout,
provider response, financial behavior or request allowance is replaced.

At that point the corrected replay still needed actual verification. The prior
[backend-only real-map pass](../real-maps-local-2026-10-18/README.md) remains
separate; it did not fill this native replay gap. No fake route was used, and no
successful application screenshot was published at that stage.

## Completed Native Application

The corrected replay subsequently **passed** at source
`bd0c391be152b2c2b7eaa69a3e025a7c007daa24`, explicitly dispatched Native CI
[39113630257](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39113630257),
artifact `12130924018` (274,943 bytes). The ten unchanged originals and their
SHA-256 manifest are retained in `completed-application/`. This later pass does
not rewrite or erase the failed first attempt above.

Run `d718aaf86712d23ecf4f388c5079cbce` completed its native/persisted stage at
`2026-10-18T09:10:02.158Z` and its independent evidence join at `09:10:03.550Z`.
Its actual instrumentation transcript reports one passed native case in 49.377
seconds. All five Places/Routes requests returned HTTP 200. The selected place
IDs, provider coordinates, native quote text (`7512 m · 9 min`), saved distance
(7,512 metres), route duration (560 seconds) and polyline hash all agree.

The real MainActivity flow selected both places, submitted the proposal, switched
between two parent accounts for separate confirmations, then switched back to
the driver to calculate through the real quote callable and apply. Parents saw
the proposed coordinates; neither had application controls. The original trip
remained stored before application. Independent local persisted checks verified
the applied proposal, both booking revisions, zero price/balance, no payment
attempts, notices and correctly scoped parent reviews. The primary evidence copy
completed. Device cleanup verified/restored the original policy at unchanged
service version `26.40.32`, with location and Maps services enabled. The complete
dispatched job, not just its native stage, succeeded.

**Map rendering remains unverified and unavailable in these screenshots.** The
local Android build intentionally removes every provider key, including the Maps
display key, even when one is supplied to the build. The reviewed applied screen
therefore explicitly says `Carte indisponible.` This run proves real address
resolution, route calculation, both in-app agreements and local application, not
map-tile display. At that stage a separately explicit map-only local build mode was still needed;
normal offline isolation must remain the default. No substitute map or modified
screenshot is used to conceal the missing preview.

At acceptance, application and replay sources at `38bf18b` were unchanged from
this successful source; the intervening commit only retained reports and partner content.
This remains an Android emulator/local-fixture result, not physical-device,
payment/refund, iOS, production deployment or launch-readiness proof.

## First Display-Enabled Attempt: Incomplete

Source `d9e59f112734729495b8306b6c2afe2fdb354f04`, manual Native CI
[39115818814](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39115818814),
artifact `12132148873` (142,753 bytes). Fifteen unchanged originals and their
SHA-256 manifest are retained in `display-first-attempt/`.

The isolated map-only build compiled successfully. Four actual Places requests
returned HTTP 200 and the app selected the same two public stations. The native
case failed in 93.2 seconds: after a parent decision's recorded acknowledgement
and unchanged-original-trip checks, `closeDialog` timed out waiting for the panel
to disappear. It did not reach quote calculation, application, or the new SDK-load
and map-pixel checkpoint. There is no result, verification receipt, applied
capture or map-display capture for this attempt. Do not infer a map load or key
rejection from this failure; the provider-error log is empty.

The panel's close control was inside its scrolling body; the newly enabled maps
made that body substantially longer. The replay clicked without checking that
the control was visible. The scoped repair keeps the header/close control outside
the weighted scrolling body and requires actual visibility before touching it.
A compact, large-text component regression scrolls between decision and refresh,
requires the close control to remain in the same visible bounds, then closes
without a decision or application. Compilation and source checks pass; the
repair and map display still require execution and visual inspection.

Cleanup restored and verified the original store policy with unchanged service
version `26.40.32`. The crash archive also contains an earlier separate Google
services SIGSEGV at 09:37:44; it is not an app crash or proof of the later dialog
timeout's cause. No deadlines, request caps, provider responses, key restrictions
or offline defaults were relaxed. No payment or production data write occurred.

## Loaded Map And Native Application: Framing Gap

Source `113c219184f498a23ac68faa15b8100301bf2453`, manual Native CI
[39117088068](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39117088068),
artifact `12132344981` (1,941,121 bytes). Thirteen unchanged originals and their
SHA-256 manifest are retained in `completed-display/`. The actual native case
passed in 68.051 seconds; the entire dispatched job also passed.

Run `21d7098846ec41c305f1dd90d315840c` completed the native/persisted stage at
10:03:04.219Z and the independent join at 10:03:05.592Z. All five real provider
requests returned HTTP 200; the selected stations, endpoints, 7,512-metre route,
558-second duration, saved route hash, both agreements and applied booking
revisions match. The close control was required to be displayed before every
parent-panel dismissal. The primary evidence copy and store restoration passed
with unchanged service version `26.40.32`.

The real SDK reported loaded; the native full display and exact 910 x 656 map
crop were reviewed. The central raster has 13,563 sampled pixels, 163 color bins
and a 0.388041 dominant-bin fraction. Actual roads, labels and station locations
are visible. **One departure marker head is clipped at the proposed map's top
edge.** This run proves loaded map tiles and application, not correct framing of
both complete pins. Its existing receipt does not contain framing proof and is
never retroactively upgraded. These originals are retained without alteration;
the clipped crop is not used to claim the framing issue is resolved.

The repair replaces fixed zoom thresholds with SDK bounds fitting to the actual
map pixel dimensions, including route points and both endpoints, with marker
padding. A fresh one-shot SDK load callback is registered after that camera move;
readiness also checks both actual projected anchors against the padded viewport.
The bounds are recalculated for route or size changes, not every recomposition
or user pan. The superseded zoom heuristic is removed. The three viewport unit
tests and native test compilation pass; an actual fitted-map replay and visual
inspection remain required. No substitute imagery, relaxed raster thresholds,
provider retries, request-cap increase or cloud restriction changes are used.

## Fitted-Map Replay: Interrupted Before Verification

Source `0001ac1d2f7ae3f4d4c8d5017f9029bca5467a9a`, manual Native CI
[39118554642](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39118554642),
artifact `12133711287` (136,797 bytes). Fifteen unchanged originals and their
SHA-256 manifest are retained in `framing-interrupted/`.

Four Places calls completed with HTTP 200 and the selected-address capture was
collected. Instrumentation then reported `shortMsg=Process crashed.` The app's
actual exit record at 10:22:51.582Z says `reason=16 (PACKAGE UPDATED)` and
`stop com.google.android.gms due to installPackageLI`. The archive also contains
Google services failures, not a recorded application camera exception. This is
an interrupted attempt, not a completed framing test or evidence that the
camera repair passed or failed. There is no route quote, result, verification
receipt, applied screenshot or framed-map capture.

Cleanup restored and verified the store policy with service version `26.40.32`.
Unchanged version numbers do not exclude a same-version package reinstallation;
the package-update exit record must not be overridden by that cleanup receipt.
The user approved continuing on a privately connected hosted Android phone with
isolated data and the existing subscription. No phone result is accepted yet.

## Ordinary Regression Rechecks

The separate routine run
[39117061358](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39117061358)
at source `113c219184f498a23ac68faa15b8100301bf2453` recorded 121 component cases:
31 skipped, one failed, zero errors. The new compact/large-text pinned-close
case passed in 7.118 seconds; its original full-window screenshot was reviewed
with the close control visible above the scrolled decisions. The draft case
failed because its old helper tried to scroll the now-pinned header. Related
helpers now explicitly require the close control to be displayed and enabled
before clicking; their body/draft assertions remain unchanged. Compilation is
verified, but the revised helpers still need actual execution. That broader run
also failed service-version restoration and is not accepted as a clean suite.

The earlier routine run
[39115804771](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39115804771)
recorded 120 component cases with 31 skips and no failures/errors, but its final
schedule-draft evidence copy exited 1 with no signal/errorCode or explicit
diagnostic. No retry or alternative copy is used to claim that run passed.
These routine component builds already include the Android map-display key;
only their separate `.local` replay is provider-disabled by default. Neither
routine job is proof that all SDK traffic is offline.
