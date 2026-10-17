# Booking Request Recovery

The displayed trip agreement remains mandatory. `requestBooking` also requires a
UUID `clientRequestId` and an explicit `requesterUserId` matching the authenticated
caller. There is no legacy request-ID generation or silent re-quotation on the
server. This mandatory contract requires a coordinated release; it is not deployed.

## Atomic Submission

`bookingRequestReceipts/{sha256(uid, clientRequestId)}` is server-only, including
for signed-in administrators using client rules. Creation of a booking and its
receipt occurs in the same transaction. The receipt binds trip, child, seats,
note and canonical displayed terms. An identical retry returns the original
booking identity; changed input with that identity is rejected. Concurrent copies
cannot allocate two bookings. New deliberate operations use new identities.

The receipt is an immutable acknowledgement of the original submission, not a
new approval or payment consent. Replays also read the original booking's current
status. Cancellation, refusal or completion stays closed; the clients direct the
parent to their reservations instead of claiming a new request was sent. Replay
does not create charges, notifications, new consent or replacement bookings.
Missing/corrupt receipts or original bookings require reconciliation, not repair
by creating a new request. Receipts and abandonment fences must not be silently
expired or deleted while retries can still reference them.

## Durable Client Intent

Both native gateways preserve an operation before sending it. The private local
store is scoped to account, trip and child, and binds the selected seats and exact
displayed snapshot. Android commits private preferences with backup disabled;
Swift atomically writes its app-support store and excludes it from iOS backup.
No authentication credentials are stored in these records. An uncertain error,
malformed acknowledgement or account change cannot discard the pending identity.
Corrupt or unwritable storage blocks submission, rather than inventing a new ID.
Only the matching acknowledgement can clear a pending operation.

If the parent selects different details while an earlier attempt is unresolved,
`resolveBookingRequest` atomically returns that original committed booking, or
records an abandonment fence if it never committed. The latter prevents an old
in-flight send from committing later. It never cancels or rewrites an existing
booking. A committed old attempt sends no changed selection; the parent is asked
to review their reservations. After a verified abandonment, a changed explicit
selection can receive a new ID. A lost resolution response keeps the old identity.
There is no automatic network retry and no alternate backend/provider path.

The payload's account binding also prevents an authentication change during SDK
token acquisition from submitting the captured intent as another account. Late
responses are checked against the account, operation and trip before local state
is acknowledged. Records for different accounts cannot share an operation.

## Verification Boundary

See the dated evidence report for the real local post-commit response-discard
test, server races, JVM coordinator checks and separate-process Foundation checks.
Native CI includes two staged SDK tests with a supervised fault proxy, an explicit
stop of only the disposable local app, a different recovered process ID, and an
independent persisted-booking check. That stage is not an interactive parent-tap
test, an iOS SDK test, or physical-device release acceptance. Only an actually
completed fresh CI receipt can establish that stage's execution.

Parent trip-change screens, broader recovery UX, physical tracking/safety events
and real payment settlement remain separate requirements. This recovery protocol
must not be presented as the completed trip-editing or release flow.
