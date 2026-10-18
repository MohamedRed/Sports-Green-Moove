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
map-tile display. A separately explicit map-only local build mode is still needed;
normal offline isolation must remain the default. No substitute map or modified
screenshot is used to conceal the missing preview.

At acceptance, application and replay sources at `38bf18b` were unchanged from
this successful source; the intervening commit only retained reports and partner content.
This remains an Android emulator/local-fixture result, not physical-device,
payment/refund, iOS, production deployment or launch-readiness proof.
