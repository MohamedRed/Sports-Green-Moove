# Booking Request Driver Notice - 23 October 2026

The current booking-request handler now commits one generic unread in-app notice
for the driver in the same transaction as the booking and idempotency receipt.
It does not include the child's identity or the parent's private note. Replaying
a committed request leaves the original notice and its read timestamp untouched.
Older committed requests are not backfilled. No automatic approval is added.

Twenty isolated authenticated service scenarios pass: the twelve existing
decision/cancellation checks and eight new request-notice checks. These include
the driver's request queue and inbox, other-account exclusion, confirmed read
and replay, concurrent duplicate sends, conflicting payloads, distinct requests,
denied/stale/abandoned requests and send-versus-resolution races. Sanitized
stored booking/receipt/notice snapshots are retained separately from assertions.
All 158 baseline fixture records and original claims remain unchanged. The owning
runtime is destroyed and all four local service endpoints are verified closed.

The exact fifteen-case transaction test is reproduced against the pre-change
3413b579 baseline in an isolated source archive: six fail and nine pass. The
current backend suite passes all 436 tests. The before-handler and exact red-test
bytes are retained. This is a fresh reproduction after earlier temporary outputs
became unavailable, not a claim that those original outputs survived.

All 24 broader local service groups pass. The chat-safety check now counts message
events explicitly and separately verifies that reading a chat message does not
mark its booking-request notice read. Its old broad source-ID count is not a valid
message-duplication assertion once both event types legitimately coexist.

Sources were uncommitted during these runs and are frozen with checksums. No
connected native UI or physical phone run, process-death recovery, push dispatch,
OS notification, production deployment/mutation or real payment is accepted.
No new image/video is added; the booking gallery retains its 22 October dates.
