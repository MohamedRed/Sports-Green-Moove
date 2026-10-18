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

The corrected replay still needs actual verification. The prior
[backend-only real-map pass](../real-maps-local-2026-10-18/README.md) remains
separate; it does not fill this native replay gap. No fake route or successful
application screenshot is added to the private site.
