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
Both new 150-percent text-size cases failed a text-layout overflow flag assertion
in `BookingFeedbackLayoutTest.inside`, not the outer screen-bounds check. This
alone did not prove clipped glyphs. The isolated backend/screen replay was not
reached. No passing native screen result or new capture may be inferred.

## Measurement Diagnosis

[Native CI 39014638308](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39014638308)
on `29a86d7a4c3dd2a25909585e3f083f360d470d07` ran 86 ordinary cases:
three failed, 19 skipped. `native-layout-diagnostic.xml` preserves this result.
The added probe contradicted the proposed height cause: the retry label reported
`317 x 75`, paragraph height `75.0`, horizontal overflow true and vertical
overflow false. The sending label likewise reported horizontal, not vertical
overflow. Increasing button height did not resolve the failures. That unproven
production sizing change is removed; the shared button keeps its prior behavior.

The resolved Android text dependency is version 1.10.6. Its official
[foundation source archive](https://dl.google.com/dl/android/maven2/androidx/compose/foundation/foundation-android/1.10.6/foundation-android-1.10.6-sources.jar)
shows `TextStringSimpleNode` asking `ParagraphLayoutCache` to reconstruct a
`MultiParagraph` for semantics using the parent's maximum constraints but the
original measured node size. The returned paragraph can therefore be wider than
the actual label. The
[text source archive](https://dl.google.com/dl/android/maven2/androidx/compose/ui/ui-text-android/1.10.6/ui-text-android-1.10.6-sources.jar)
defines the width-overflow flag by comparing those two widths.

The corrected assertion checks the real node bounds and reconstructs the label
using its actual measured width, the same text/style, density and font resolver.
It requires the full label, every line within both horizontal edges, the line
limit preserved and the measured height sufficient. A separate controlled probe
must reproduce the larger semantics paragraph while proving the complete label
fits its measured frame. The requirement remains unclipped, readable text; a
synthetic semantics flag is not substituted for that requirement. The next
device run must provide numeric measurements and reviewed captures.

The original CRLF bytes of the first device report are restored in the evidence
snapshot; an earlier Git addition normalized only its line endings. Test results
and case contents are unchanged. Scoped attributes now preserve raw native
reports without changing source-code whitespace checks.

The corrected device run remains pending in this snapshot. The wider release,
physical phones and the other booking entry points remain incomplete. No
production rollout has occurred.
