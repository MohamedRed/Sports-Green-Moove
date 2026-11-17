# Schedule Draft Across A Real App Restart

Source `99dfc6811191f3a613f722743ae8ad278b29b604`, Native CI
[39111241065](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39111241065),
artifact `12131137549` (15,476,606 bytes). Originals are retained without rewriting
under `originals/`, with a SHA-256 manifest.

The local replay completed at `2026-10-18T08:52:44.371Z`, run
`61c4bc3d855a68e23bb2645c914c171b`: all 33 flow groups, 35 native cases across
27 instrumentation transcripts, and all twelve primary evidence copies passed.
The new two-case schedule-draft stage completed at `08:51:17.254Z`.

The actual MainActivity editor changed the date and departure time, enabled
desired arrival, and retained the original places and price. After a guarded
force-stop, process 13067 was replaced by 13209. The driver session was recovered
without another login, and the UI and saved private record retained 20 October,
13:00 departure and 14:00 desired arrival in Brussels time. An independent host
conversion checks these against `11:00Z` and `12:00Z`.

The draft hash was identical before and after restart. The other trip's private
draft remained absent. Independent trip, booking and notification hashes were
identical before editing, at the checkpoint and after restart. No proposal,
quote, adjustment or ride was created; an enabled proposal button was never
pressed. Both screenshots are original device-only captures, with the restored
one reviewed for the partner site.

**The overall CI job remains failed.** Five separate ordinary/component cases
timed out waiting for their own input window to gain focus. The original ordinary
XML records 118 cases, 30 conditional skips, five failures and no errors. Its
failing cases are retained rather than erased by the completed local replay.
Build, evidence collection and local replay exited zero. Store cleanup restored
the original policy and verified the unchanged `26.40.32` runtime with location
and Maps enabled. This failure is not a service-update or primary-copy failure.

This accepts only the local schedule-draft/restart scenario and completed local
groups. It is not physical-device, iOS, map-route/application, payment/refund,
production deployment or launch-readiness evidence. Older failed attempts remain
in their original reports.
