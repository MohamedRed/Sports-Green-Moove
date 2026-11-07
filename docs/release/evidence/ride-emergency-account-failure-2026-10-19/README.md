# Active-Ride Account-Switch Failure

The original 7dc5a99 Android run executed the expanded native ride test against
isolated data. The driver opened the contact screen from the active ride, saved
the fictional number, opened the actual dialer without calling, removed the
contact and returned to the same ride. Four unedited captures were reviewed.

After driver sign-out and parent sign-in, the read-only service-presence check
failed: the driver location service was still running under the parent session.
This does not prove that positions were delivered to that parent. The original
15-second assertion failed before the parent's contact journey, driver resumption,
ride completion and independent success verifier. None of those outcomes passed.
There is no primary successful ride-contact marker or transfer. The retained
files came from the failure-cleanup collection and must not substitute for a
successful full journey or store-review evidence.

The original transcript, account observations, dial attempt, four driver captures,
collection receipt and device restoration are preserved with hashes. Temporary
test administration and its component were removed and original device settings
were verified restored. Sources are bound to matching bytes from 7dc5a99, not to
later corrected code. No physical device, production record or real payment was
used. A later repair or passing unit test cannot change this failed outcome.
