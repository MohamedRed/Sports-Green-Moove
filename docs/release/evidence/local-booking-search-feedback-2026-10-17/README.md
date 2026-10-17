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

The parent-screen replay and narrow/large-text layout cases are implemented and
compiled locally but have not yet been executed on the test device in this
snapshot. No native UI pass, new capture, physical-phone result or production
rollout is claimed here. The wider release and the other booking entry points
remain incomplete.
