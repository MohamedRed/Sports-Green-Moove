# Local Search Criteria And Seat Evidence

Date: 2026-10-15 UTC. This report separates state/payload checks from isolated
service execution. No production writes, live providers, real payments, physical
tracking or final release-manifest approvals are involved.

## Reproduced And Corrected

`binding-baseline-failed.xml` records five genuine failures against `8e566b4`:
booking without a completed search, booking after editing a place, substituting
a child different from the completed search, requesting an unrelated result, and
dispatching a search without consent despite the service's hard consent filter.
The native gateway also hardcoded one seat instead of accepting the search's
selected count. The server already accepts seat counts and calculates payment
amounts from them; no payment/pricing policy was changed.

Search form/query state now belongs to the session controller rather than a
recreated screen. Every option change invalidates results and pending responses.
Changing child or tracking resets consent. Child removal clears selection rather
than silently selecting someone else. A booking must belong to the current,
completed criteria and receives that criteria's child and selected seats. The
gateway uses a validated structured payload; other one-seat actions pass one
explicitly. The existing server consent requirement is preserved, not weakened.

## Unit And Payload Results

Original Gradle XML files are copied unchanged, with zero failures/errors/skips:

- `binding-passed.xml`: 5 booking-binding and consent cases.
- `criteria-passed.xml`: 9 cases covering all option changes, in-flight results,
  child/consent changes, invalid input, capacity, selected seats and clearing.
- `payload-passed.xml`: 3 structured request mapping/validation cases.
- `requests-passed.xml`, `lifecycle-passed.xml`, `safety-passed.xml`: the preceding
  15 request-lifetime/state regressions rerun against the updated contract.

That is 32 search-related checks, including 17 new ones. The full Android unit
suite and instrumentation APK compilation also pass locally. Unit gateways are
explicit synthetic doubles, not proof of real route-provider matching.

## Persisted Service Results

`services.json` is unchanged output from run `f8e5aa4a79b17bec8b70cf7023108e97`,
completed at `2026-10-15T23:53:41.108Z`: all 14 isolated service groups pass.
The new case creates a four-seat trip and requests two seats for the guardian's
child. The booking stores two; requesting does not decrement seats; approval
changes four to two; the driver's queue reports two; cancellation restores four;
a repeated cancellation is rejected without adding seats again. Five seats
cannot be requested from a four-seat trip. No payment is performed.

The earlier `service-harness-attempt.json` is diagnostic, not accepted evidence.
Its new assertion looked for `id` instead of the documented `bookingId` in the
driver queue. This was a harness error, not an application seat-count failure.
An initial Java runtime selection failure occurred before service execution;
the accepted run explicitly selected JDK 21 on PATH and JAVA_HOME.

## Still Pending

Two new component UI cases cover option invalidation and navigation retention
with explicit fake gateways. A separate local-only native SDK case requests two
seats through the actual Android gateway; an independent service verifier must
then inspect, approve and cancel that persisted request. These additions compile
but still require a complete fresh native run and reviewed images. No new screen
or SDK success is inferred from the unit/service results above.

The first expanded CI attempt, `38826908503` on October 16, stopped in the
general instrumentation phase: its two new component cases used ambiguous seat
text and a mixed-case selector for an uppercase host button. Those are test
selector defects, not accepted app failures or successful screen evidence.
The selectors now distinguish clickable choices from static result text and use
the host button's explicit identifier. All selection and booking assertions stay
in place; a fresh complete run is still required.

Attempt `38828218654` passed the general instrumentation phase and both new
criteria UI cases. Its local group then failed three older cases with missing
Compose roots and a landscape capture where portrait was required. The landscape
test unconditionally enabled sensor rotation during teardown instead of
preserving the inherited portrait lock, and did not await portrait restoration.
Landscape/theme cleanup now waits for portrait configuration/display dimensions
and only re-enables automatic rotation if it was enabled on entry. This remains
diagnostic partial execution, not an accepted complete native run. The SDK case
was not reached. The crash buffer was empty; this does not resolve the separately
recorded earlier SlotWriter crash.

The expanded native runner requires 14 instrumentation cases, including one
SDK-only case, across six invocations. This is not 14 physical-phone journeys.
Earlier [11-case screen evidence](../local-search-ui-2026-10-15/README.md) remains
unchanged and separately scoped.

Real matching/ranking, full app navigation/authentication, booking retry
idempotency across network failures/restarts, other account action callbacks,
the earlier lifecycle crash, management actions and physical phones remain open.
The date control still needs a user-friendly picker. Client binding does not
replace server authorization or current capacity checks. iOS is unchanged.
