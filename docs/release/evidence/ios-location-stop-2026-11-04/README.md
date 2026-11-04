# iPhone Location Capture Stop Ownership, 4 November 2026

Controlled native provider/state proof only. No physical location, real network,
rendered screen, provider-service or completed sign-out acceptance. Android and
iPhone remain in release scope.

## Reproduction Against The Original Provider

The actual `NativeLocationFallbackProvider` at
`84aa1349933844f78fd9180d33583301f0c35e1f` waits for its first upload before
storing the continuous session. Its stop method checks only that stored session.
An exact-ride stop during the upload therefore does nothing; the delayed completion
then starts continuous capture. The same controlled sequence now cancels startup,
performs one local stop and never enables continuous capture. One first upload was
already in flight in both cases: the fix cannot withdraw an issued request.

`before-after.txt` is the original output, including the legacy optional-enum
switch warning. Both comparison binaries use Swift 5 mode so the original body
can compile. Only the temporary copy's iOS compilation guard is broadened to admit
the controlled CoreLocation module on this Mac. Neither original nor candidate
method bodies are rewritten. Shared model/error dependencies and the test entry
point are the same. This is not a historical full-app build or a real Apple
location-framework test.

`strict-draft-failure.txt` retains a later draft's two non-Sendable-manager capture
errors. The final body computes immutable object identifiers before entering
Sendable lock closures. No unchecked conformance or warning suppression is used;
the passing strict receipt belongs to that corrected source.

The independent default command compiles the candidate provider body, real
`LocationSessionState` and model types with Swift 6, complete concurrency and
warnings as errors. It executes the production provider methods, not a duplicate
implementation. `provider-checks.txt` retains that scoped successful result.

## Root-Cause Changes

Startup has an owner before any authorization, capture or upload await. Every
boundary checks cancellation and ownership before progressing. Exact-ride and
global stop revoke both pending and active work, stop local capture, resume pending
authorization/location continuations once, and cancel queued upload tasks.

Each session owns a separate location manager. Delegate events check its object
identity and snapshot the owner under `OSAllocatedUnfairLock` before entering the
main actor. Thus even an old manager callback delivered after a newer same-ride
session starts cannot satisfy its capture request. Current continuous uploads register their work; a later
start is refused until abandoned startup and issued uploads settle. No delay,
automatic retry, provider fallback or deadline increase is introduced.

Duplicate starts no longer overwrite a pending capture continuation. An old ride
cannot stop another ride; old cleanup cannot erase a new owner. Missing optional
authorization status is explicitly rejected. `ProviderConfigurationError` moves
unchanged into its own small file so the actual provider can compile with minimal
production dependencies rather than unrelated app-runtime code.

## Coverage And Limits

The controlled provider cases cover the initial-upload stop race, permission wait,
capture wait, late permission/location events, task cancellation during an upload,
unsettled-start denial, current successful startup, duplicate active startup,
exact-ride stop, global stop, old-manager success/error after a same-ride restart
and initial-upload failure. The ordinary native checks
also exercise pending-start/upload drain and generation isolation against the real
state type. A separate early harness preparation failed while compiling unrelated
runtime types in Swift 5, then with a missing model dependency; neither launched a
provider trial. The corrected minimal source list is explicit in the runner.

The dedicated fixture contains only controlled coordinates and counters. It makes
no CoreLocation, location-provider or backend requests. Candidate checking is added
to the existing bounded iPhone job. Web Integration Smoke validates contracts and
both workflow events; existing commands, seven UI cases, 35-minute budget and
no-native-upload policy are retained. No Terraform change is needed.

Full sign-out remains open: the profile button is still unwired, ride/permission
orchestration must reject stale account work, all local services and provider
identity must stop, issued transports need their own identity/drain boundary, and
the new source needs SDK-linked, rendered and real-device proof. The current GPS
sample-quality and physical failure scenarios are not accepted by these checks.
No ride is remotely ended, no account is switched and no production data changes.

Publish one short local update, preserving all flows, phone dates, tours, statuses,
blockers, prior updates and 532 media files. No new visual evidence is claimed.
