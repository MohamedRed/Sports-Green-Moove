# Foreground Ride Observation

Android observes changes to the selected ride's Realtime Database location record
and server-confirmed Firestore ride document. Change signals are conflated; each
read uses the authenticated `getActiveRide({ rideSessionId })` callable. The
explicit id is validated and authorized against the ride. Completion returns
null for that ride rather than selecting another active ride.

The stream belongs to one authenticated Firebase user and one ride. Authentication
changes close it; disposal removes all listeners. The UI observes only while its
lifecycle is at least STARTED. Pause/resume performs a new authorized read.
Account-generation checks reject callbacks from a cleared account, including when
another account happens to see the same ride id. A slow general refresh cannot
overwrite a newer live snapshot.

The response includes structured capture ages and point-presence/source fields.
Android advances those ages with elapsed realtime, not its wall clock and not
label parsing. It conservatively includes the entire callable request duration;
this may warn early but cannot extend the freshness window because a response was
slow. The existing strict greater-than-90-seconds threshold is retained. Unknown
timestamps remain unverified and missing points remain distinct. No coordinate,
timestamp, child device or alternate tracking provider is fabricated.

Loading, paused or failed observation does not leave a green LIVE state. The ride
screen hides operational controls until a current response is available; failure
offers an explicit retry without internal diagnostics in the UI. The service
stream is not automatically replaced by cached or polled data. A one-second local
age tick does not issue network requests.

After remote completion, the UI clears that ride and refreshes trip history and
ledgers without discovering or opening a different active ride. Discovering rides
started after initial app refresh, selecting among multiple simultaneous rides,
live map coordinates, child-specific location presentation and physical recovery
scenarios remain separate unfinished requirements.

## Verification And Rollout

`test:ride-observation-services` executes seven isolated authenticated callable
groups: selected-id stability across two active rides, missing-point metadata,
capture ages, outsider/unauthenticated denial, invalid references, pickup changes
and completion without switching rides. Original output and source bindings are
retained in `docs/release/evidence/ride-observation-services-2026-10-19`.

Android unit tests cover monotonic aging, request latency, cancellation, account
changes, malformed responses, passenger changes and completion. The separate
`test:ride-observation-ui` scenario uses the real app and Firebase SDKs with a
parent account and a separate authenticated driver peer. The peer injects
synthetic positions and invokes passenger/completion callables; it is not a GPS
hardware or driver-screen test. It requires the original instrumentation pass,
primary capture transfer and independent persisted-state/cleanup verification.
Compile-only or partial captures cannot accept that native scenario.

The first visual trial stopped in Android startup before the scenario; its
platform ANR and failed command are retained separately. The virtual device had
CPU starvation during initial system bootstrap, including other Android services.
That negative run cannot supply current screen proof.

The completed independent native trial and its eight reviewed captures are in
`docs/release/evidence/ride-observation-native-2026-10-19`. It passed the original
case, primary transfer, persisted-state verification and cleanup. The local
database instance is retained across activity recreation, rather than resolved
again after emulator configuration. The two intervening native failures remain
negative in separate evidence directories. This is one new independent case,
not a replacement for the existing full native replay or physical-device matrix.

Deploy and verify the matching backend before externally distributing the new
client. The configured observer rejects a response without structured ages.
External Android preview distribution now requires a manual dispatch confirming
credential rotation and backend readiness; ordinary push validation remains in
Native CI. Do not reuse the previously exposed external test-provider key.

No local observation proof accepts physical GPS, signed provider webhook delivery,
network-loss recovery, the native fallback service's full lifecycle, child-device
authorization, store review or safety-audit export requirements. iOS observation
has not been changed by this Android implementation.
