# Private Unfinished Trip Edits

The owner approved retaining unfinished trip edits on 18 October 2026. Android
stores them in app-private preferences with an unambiguous account/trip key.
Application backup is disabled. No draft is sent to another person or written to
the trip. Reopening authenticates and reads the current server preview first.

The record preserves raw price, Brussels dates/times, optional-arrival selection,
both address inputs and their previously resolved coordinates/addresses. Invalid
and incomplete inputs remain editable; an unresolved address never acquires
coordinates, suggestions, a provider quote or confirmation through restoration.
Transient searches, errors and provider responses are not persisted.

Each user edit commits its small bounded record before being considered saved.
A failed save retains the typed input, displays an error and disables submission
until saving succeeds. Storage corruption/read errors fail visibly, without
discarding the record or silently opening a blank editor. There is no cloud,
cross-device or iOS draft persistence in this implementation.

Records carry the authoritative original terms and revision. A changed revision
retains the private draft but locks submission; only the driver's explicit
“Repartir des détails actuels” replaces it. Restoring a draft is not parental
consent and never updates the trip or sends a proposal automatically.

Before a proposal leaves the device, its exact request identity and frozen terms
are committed alongside the draft. After an uncertain result or reopening,
read-only resolution runs before preview. A matching committed result clears
only its matching draft; a failed resolution leaves actions locked. An explicit
unchanged retry retains the request identity. Editing after authoritative
non-recording invalidates the old request identity. Unrelated history reviews
and parent actions cannot erase or read the driver's draft.

## Verification

Eleven new JVM cases pass, alongside all 245 Android unit cases. They check raw
unfinished inputs, account/trip isolation, new-state recovery, stale revisions,
save/read failures and proposal idempotency. Three instrumented cases compile,
covering large-text close/reopen, real preferences/codec and corrupted records.
Those three component cases passed in run 39085527859, without accepting that
broader failed run or any physical-phone requirement.

The full isolated replay additionally requires `trip-draft-process-restart-ui`:
two real app instrumentation stages around the existing guarded local-app
force-stop, without clearing data. The driver types a raw price and two unresolved
addresses, checks a second trip stays empty, then must recover the same draft in
a different process without another login. Native private-store checks require
no pending proposal and no confirmed coordinates; both stages compare the draft
hash. Independent host snapshots require the full trip, booking and notification
records to remain unchanged and no proposal, quote, balance or ride to exist.
Only same-run completed receipts and two non-empty real captures permit the new
group to pass. The full replay now requires 33 groups; older 32-group originals
remain unchanged and do not prove the new draft stage. Both actual stages passed
in run 39085977464 and the restored image was reviewed; the broader run still
failed in separate capture/network-preparation checks. See the
[scoped evidence](../release/evidence/local-trip-drafts-2026-10-18/README.md).
Other draft variants, physical phones and iOS remain unproven.
