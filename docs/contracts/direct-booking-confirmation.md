# Booking From Home And Trips

Opening a trip card as a parent is a read, never a booking command. Show the trip,
current departure, price and explicit one-adult/one-seat choice before confirmation.
The existing child/multi-seat search workflow remains separate and unchanged.

Read fresh trip terms and the current account's paginated reservations before
enabling submission. A matching requested or approved adult reservation is shown
instead of a new send action. Do not infer absence from a failed, foreign or
repeated-cursor response. This UI check adds no backend one-booking-per-parent rule.
Deliberate new searches retain their existing behavior.

One explicit confirmation submits through the existing durable booking gateway.
Repeat taps and switching cards cannot change an in-flight operation. A successful
acknowledgement removes the send action. An unconfirmed reply stays explicitly
retryable using the same gateway identity; no automatic retry is permitted.
Changed terms require reload and a new explicit confirmation.

The controller belongs to the authenticated account. Dismissal invalidates read
callbacks; logout closes the controller, cancels its work and clears private state.
A late read or response cannot mutate the next account. Reopening after process
death reads the existing reservation from the server rather than trusting a local
success flag. Driver and child ride-start permission behavior is unchanged.

The original controlled regression produced three fake-gateway calls for three
card taps. Eleven controller tests and 613 native unit tests pass after the change.
One actual physical-phone trial passes eight independent read-only checkpoints,
including zero writes on open/dismissal, one confirmed request, process restart,
cross-entry-point restoration and sign-out. See
`../release/evidence/direct-booking-confirmation-2026-10-28/README.md`.

The two native component cases subsequently execute successfully in Native CI
40735408854 on c898253; their declared fake gateways do not prove a physical fault.
Response loss on a physical phone, search-screen restoration, simultaneous devices,
payments, push notifications, iOS and production rollout remain outside this proof.
