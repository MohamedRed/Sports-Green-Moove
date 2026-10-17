# Android Search Booking Feedback

The original controller regression reproduces two provider calls when the same
search result is submitted again after its successful acknowledgement. Its raw
JUnit receipt is `controller-before.xml`: four cases, two failures. This is a
controlled controller test, not a recording of duplicate real bookings.

`controller-after.xml` retains all four original cases and three new checks:
seven cases, no failures. They cover successful result consumption, explicit
retry, deliberate new searches, pending repeat taps, a response from an older
search, changed choices and account closure. These tests use explicit fake
gateways. See the complete [feedback contract](../../../contracts/booking-search-feedback.md).

`controller-final.xml` retains the passing final eight-case controller suite,
additionally distinguishing a definitive business rejection from an unconfirmed reply. Only the latter gets
the retry label; the original reply-error case now uses that typed domain error.

## Interrupted First Device Run

[Native CI 39013901545](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39013901545)
on `099de1a49ef1d61104da6d222c89e3194d966033` ran 85 ordinary cases:
two failed, 19 skipped. The original report is `native-layout-before.xml`.
Both new 150-percent text-size cases failed the actual text-layout overflow
assertion in `BookingFeedbackLayoutTest.inside`, not the outer screen-bounds
check. The isolated backend/screen replay was not reached. No passing native
screen result or new capture may be inferred from this run.

The shared button constrained its label to a fixed height. The correction uses
the existing size as a minimum and allows measured text plus vertical padding
to grow. A controlled test-only copy of the old height is retained as a probe:
it must demonstrate vertical, not horizontal overflow at the same text scale,
while the production button must fit. Its numeric receipt will distinguish an
actual sizing cause from merely accepting a later green run. No assertion is
removed or weakened.

The corrected device run remains pending in this snapshot. The wider release,
physical phones and the other booking entry points remain incomplete. No
production rollout has occurred.
