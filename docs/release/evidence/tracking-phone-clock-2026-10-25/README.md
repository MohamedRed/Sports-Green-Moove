# Physical Android Tracking Attempt: Clock Rejection

25 October 2026, physical Pixel 9 Pro / Android 15, BrowserStack App Live.
Run `54a5ea3a8592cd65877ccbeb03b5a617` is **incomplete**, not release evidence.
Canonical checkout: `899e969c90d404cbbdc38976269e0fb1a517e281`; native and backend
application sources are unchanged since `9b59f3113021c5e03024f083102d6d321fc22049`.
The reused local-only APK SHA-256 is
`23563b391c8dfd873f6a877c16c80f53dbe3aaf11d14d7d409d25a562180d593`.
Its exact earlier upload is selected. No production data, external map requests,
real payment, device administration or installation guard is used.

## Actual Sequence

1. Prepare one free trip and an approved two-seat child booking in the disposable
   demo backend. No location or active ride is written by the observer.
2. Set a synthetic phone GPS point to 50.7167, 4.6167. The driver signs in and
   starts this trip through its card. The in-app disclosure, precise permission,
   background permission and notification permission are observed.
3. Startup reports an unconfirmed GPS point. The backend contains one active
   ride and its metadata, but no vehicle point. Refreshing the same mock point
   and retrying does not create another ride. A later retry after the OS mock
   providers report that point still does not complete startup.
4. Add timestamp-only console observation to the **disposable compiled backend
   copy**, retaining its before/after files. No application repository handler,
   ordering rule, payload, authentication, coordinate or response is changed.
   The next app retry accepts one actual native point and opens the active ride.
   The earlier startup error remains visible, a separate stale-error UI issue.
5. Change the phone to 50.7177, 4.6177. Read-only OS diagnostics confirm that
   coordinate. Forty-five backend observations over 90 seconds never see it.
   The first position remains; the app displays its increasing age and warning.
   A separate authenticated parent read reports the same ride as stale.
6. Stop the observer explicitly as incomplete after only `prepared` and
   `foreground-first`. No later checkpoint is fabricated or skipped into success.

## Clock Diagnosis

The bounded OS clock observation reports a phone RTC at least 533 ms ahead of
the local host's observation endpoint. The timestamp-only transaction extract
contains 48 observations: one valid capture 277 ms behind its server check,
then 47 invalid captures 1463-2018 ms ahead. The unchanged capture validator
requires positive integral capture time no later than the server's current time.
These are transaction observations, not a fabricated completed user-flow count.

`clock-diagnostic.json` is an extracted diagnostic, not a complete original log.
It contains no keys, auth tokens, request bodies, coordinates or account IDs.
The two backend-copy source files show the only diagnostic edit. Historical
location extracts include prior console results; `latest-location-extract.json`
selects only the last location-manager result, containing the second coordinate.
The backend final state is independently unchanged from the first accepted point
except the owned vehicle register; all other root records, bookings, claims and
live trips match. This is not an audit of every nested collection.

Do not accept future points or replace their capture time with receipt time to
make the test pass. Clock handling needs a safe correction and a fresh replay.
Background, locked-screen, loss/recovery, child GPS, actual movement, ETA,
provider delivery, iOS and production release scenarios remain unproven.

## Captures

All images are untouched, unscaled 253 x 564 browser device-viewport JPEGs, not
native-resolution exports or video. Three reviewed images enter the public
gallery: startup failure, the first accepted point, then the stale position.
The map is deliberately unconfigured in this APK; its unavailable panel does
not establish a new maps defect. The permission and sign-out views stay retained
only. No new store or real-device manifest item is accepted.

## Disposal

The driver signs out through the app and returns to the empty login form.
An app-scoped service query no longer lists ActiveRideLocationService, while
retaining a Google location-client binding; no broader service-absence claim is
made. The provider acknowledges uninstall. Its supported `dumpsys package`
query independently reports the package absent; Stop Session returns to the idle
device picker. The local observer exits naturally with Firestore termination
and Admin-app closure. The owned helper and backend exit 130; their directories
and private session file are absent and ports 5001/8080/9000/9099 are closed.
The owned clipboard and credential variables are cleared. The entire disposable
backend, including its diagnostic edit and active ride, is destroyed.
