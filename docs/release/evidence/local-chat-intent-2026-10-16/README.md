# Uncertain Message Intent Across Retry Errors

Local JVM tests reproduced a client identity-loss defect, not a measured production duplicate.
The baseline controller preserves the former route's rejection decision: any
definitively rejected retry discards its pending request UUID, even after an
earlier attempt had an uncertain outcome. A subsequent send then allocates a new
UUID. A rejected retry does not establish that the earlier attempt never committed.

## Retained Red And Green Reports

- `identity-baseline-failed.xml`: six tests, two failures. Pending identity is
  lost after a rejected retry, including cancellation and controller recreation
  using the existing saved holders.
- `monotonic-baseline-failed.xml`: seven tests, three failures. The additional
  case shows a late exception restoring an error after acknowledgement was
  already observed and had cleared the pending message.
- `composer-passed.xml`: the same seven cases pass, with no skips or errors,
  at 2026-10-16T12:48:00.996Z. These are unmodified generated JUnit reports.

The fix remembers whether an attempt follows an unconfirmed attempt. Only a
first-attempt definitive rejection can release that intent for editing. Unknown
or cancelled sends keep their original UUID and text through subsequent retry
errors. A known acknowledgement remains terminal even if a later RPC exception
arrives. Fresh definitive rejection still allows editing and a new intent.
Overlapping sends/edits, stale acknowledgements and invalid draft lengths are
also covered. The old in-route send branch has been removed; the route invokes
the tested `ConversationComposerState` rather than a parallel unused helper.

The existing two `rememberSaveable` holders remain strings for draft and pending
UUID. Transient sending/error state remains separate. Reusing these holders in a
unit test is not durable draft recovery, an OS force-stop or a physical-device
test. No disk-backed queue, new permission or fallback was introduced.

## Scope And Remaining Work

The new `ConversationFlowTest.aRejectedRetryDoesNotReplaceAnUnconfirmedSend`
uses the explicit component fake gateway and checks the three UI sends reuse
one identity/body. Local compilation does not prove screen execution. Its
execution must be read from the corresponding native CI result, not inferred
from this JVM report. A combined real SDK/transport fault and physical phones
still require separate evidence. The app and rules are not deployed to production.

The earlier complete 19-case app replay is retained in
`../local-chat-restart-2026-10-16/`. Actual local HTTP response loss after a
verified commit is separately retained in `../local-chat-response-loss-2026-10-16/`;
its 18-group service runs do not demonstrate the new composer policy on a phone.
Team conversations, live delivery and tracking remain open. The old SlotWriter
crash, missing default data subscription and CI-device shutdown hang have not
been explained or closed by this change.

A dependency audit during validation reported 53 unresolved findings: 24 moderate,
25 high and four critical. The selected XML parser was not reported as vulnerable;
no dependency versions were upgraded by promoting its existing locked version to
a direct development dependency. No bulk audit fix or security-clear claim was made.
