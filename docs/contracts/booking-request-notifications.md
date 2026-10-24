# Booking Request Notifications

A newly committed booking request creates one unread in-app notice for that
trip's driver, in the same transaction as the booking and its request receipt.
No seat is removed until the existing approval flow succeeds. The notice has a
stable identity derived from the event, booking and recipient, using the existing
booking-notification ID format. Approval, decline and cancellation IDs do not
change. Its generic title/body include neither child details nor the private note.

Replaying a committed client request returns the original booking and does not
rewrite the notice, its read state or read timestamp. Transaction contention
cannot leave a booking without its request notice or create multiple notices for
the same committed request. A notice write failure aborts the booking and receipt.
Distinct new client requests remain distinct bookings under the existing policy.

Unauthenticated, foreign, stale, unauthorised-child and abandoned requests create
no request notice. Only the owning driver receives it through their inbox and
can mark it read. Reading it neither approves the request nor changes capacity.
The existing parent decision and driver cancellation notices stay separate.

Old committed receipts are not backfilled on replay. This change does not add
push dispatch, an OS alert, a new permission, an automatic approval or a legacy
fallback. Existing client inbox rendering consumes title/body without a new app
format. Deployment and a connected app/physical-phone run remain separate from
local service and unit checks. No production mutation or real payment is needed
for the isolated checks.
