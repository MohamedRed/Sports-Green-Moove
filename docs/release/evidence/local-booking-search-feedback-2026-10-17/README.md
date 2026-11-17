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

## Executed Search-Screen Stage

[Native CI 39015636778](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39015636778)
on `579486f33f1509d8b8ee38d97b5d139eac4550a2` declared 86 ordinary cases:
67 passed and 19 conditional cases were skipped. `native-layout-after.xml`
records zero failures/errors. All three new layout/measurement cases passed.
The numeric `width-probe.json` reports a measured label width of 317 pixels but a
reconstructed semantics paragraph width of 734 pixels. Remeasuring at the actual
317-pixel frame retains the complete label and its 75-pixel height. No height
overflow was present. This confirms the measurement diagnosis rather than a
button-height defect. The original production button sizing is retained.

The isolated search-screen test passed (`native-booking-ui-passed.txt`, one
executed case). Run `9c36b2e83bed87a618800ae0a4211d42` independently verified
two real booking SDK calls, one booking and one receipt. The first successful
server reply was discarded after its committed booking was independently read;
the parent saw the unconfirmed message and pressed retry. The same operation
returned the original booking, cleared its pending identity and displayed
`Demande envoyée.` without another request button. A stale callback made no
third SDK call. `booking-ui-loss.json` retains the independent receipt and
`local-booking-ui-loss.json` the original screen assertions. Reviewed captures
show the unconfirmed and acknowledged states. Discovery remains explicitly
stubbed; no provider search or process restart is claimed for this screen test.

## Later Handover Rejection

The same full run **failed later**, despite the app network case reporting
completion (`native-network-app-before.txt`). Its original
`network-handover-before.json` still lists both Wi-Fi and cellular transports in
the supposedly cellular-only sample. The unchanged host verifier rejected it;
there is no complete 24-case result for this run. An app self-report does not
replace independent handover evidence or qualify the whole run as passing.

Readiness previously checked the active cellular network, then took a separate
sample of all networks for evidence. The corrected test instead waits on the
same immutable observation that is recorded. Both active and all Internet
transports must be exclusively cellular, the Wi-Fi flag off, data enabled,
an active network present and the backend reachable. Counts and transport names
come from the same capabilities collection. This is not an atomic OS transaction;
it removes the separate readiness/evidence sampling mismatch. No deadline,
network setting, retry, route fallback or assertion is relaxed. Fresh verifiers
require observation version 1 and both exclusive transport fields. Historical
receipts retain their original validation/version and bytes.

## Current Recheck

[Native CI 39017050031](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39017050031)
on `9fe107960e36e7c61c817c988193e149e80a530a` ran 88 ordinary cases:
69 passed, 19 conditional cases skipped, zero failures/errors. Both new
exclusive-observation predicate cases passed (`native-layout-recheck.xml`).
The real booking screen stage passed again (`native-booking-ui-recheck.txt`).
`booking-ui-recheck.json` independently confirms two calls, one booking and one
receipt. Its collection timestamp is retained in `booking-ui-collection-recheck.json`.

The full replay **failed later before disconnect**, at the unchanged 30-second
network-preparation wait (`native-network-recheck.txt`). The original
`network-preparation-recheck.json` has no network transitions and completion is
false. It records no default data subscription, no cellular callback and only
Wi-Fi, despite mobile data enabled. Thus the corrected cellular-handover
observation was not exercised by this recheck. This is the earlier intermittent
preparation problem, not proof the separate sampling mismatch is solved live.
No blind rerun, relaxed deadline or alternate route is substituted.

`results.json` is an explicitly derived one-stage summary for the private portal,
not the absent full-run result. Its successful stage and date are checked against
the raw instrumentation, independent booking receipt and collection timestamp.
The two displayed captures remain the earlier reviewed stage from run
`9c36b2e83bed87a618800ae0a4211d42`; they are not relabeled as recheck captures.
The wider release, physical phones, other booking entry points and actual
search-screen restart recovery remain open. No production rollout has occurred.
