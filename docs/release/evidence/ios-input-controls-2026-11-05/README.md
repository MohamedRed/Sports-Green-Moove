# iPhone Input Controls, 5 November 2026

Controlled state proof and two UI candidates, not an SDK-linked build, native UI,
physical-device or release acceptance. All earlier D51/EEF outcomes stay intact.
No provider request, production write, phone session or new media is added.

## Reproduced Team Draft Loss

The actual baseline `TeamChatState.canCompose` includes `!busy`. Both the editor's
enabled state and its binding setter depend on that property. History refresh,
pagination and read acknowledgements set the same `busy` flag, so keystrokes
arriving during a read are rejected. This reproduces the D51 truncation mechanism
in the actual state setter; it does not prove every detail of keyboard timing.

The same new controlled driver runs with the original baseline state and then
the candidate. Twelve scenarios cover three reads (refresh, earlier page and
read acknowledgement) across success, failure, background and account change.
The baseline retains only `Message de test iso` after the final characters are
offered. The candidate persists the exact `Message de test isolé` in all twelve.
No message is dispatched during those reads. Late completions cannot restore
private text after closure; owned callback leases are drained. The original
unknown-send, stable UUID, exact receipt and rejection checks also still pass.

The candidate separates private draft editing from dispatch availability:
read-only work no longer disables typing, but `canSend` still requires `!busy`.
An unresolved send still locks the editor and keeps its original immutable intent.
No polling, volatile-storage fallback, synthetic receipt or automatic resend is
introduced. The existing polling cadence is unchanged.

## City And Membership Candidates

The city row previously replaced its nested button's accessibility element with
an ignored-children wrapper. The candidate removes that wrapper and preserves the
real button, label, value, identifier, read/save ownership and disabled states.
[Apple documents that ignoring children creates a new element without initial properties.](https://developer.apple.com/documentation/swiftui/accessibilitychildbehavior/ignore)
The unchanged fixture must still prove the actual button type, save/reopen/removal.

The plain club-choice button now declares its whole existing minimum-44-point
label as its hit-testing rectangle, including the blank center. This matches the
existing team-directory button pattern without changing layout, predicates or
click coordinates. [Apple defines content shape as the hit-testing shape.](https://developer.apple.com/documentation/swiftui/view/contentshape(_:eofill:))
The actual D51 membership failure's cause is not accepted as proven by this edit.

A separate strict-concurrency executable compiles the original
`UITestMembershipGateway` and production `MembershipReviewState`, with only a
minimal app-container/gateway-shell substitution. Fresh processes pass both
approval and rejection: exact selected club, owner, request/version, fresh-read
decision state and callback cleanup. This narrows the investigation; it is not a
screen tap or provider test. Three initial diagnostic builds exposed omitted
domain dependencies in the new harness, not application failures; their local
logs remain separate from the completed fourth harness build.

## Verification And Remaining Work

`baseline-result.txt`, `candidate-state-result.txt` and `complete-native-result.txt`
retain the actual executions. The complete native script includes both fixture
decisions. Strict callable-signature checking and SwiftUI syntax parsing pass;
neither substitutes for the iPhone SDK. Source hashes freeze both tested states,
the baseline driver and all unchanged UI test files.

All eleven fixture cases, exact full-message assertions, tap predicates, deadlines,
50-minute job limit, concurrency and optional three-image/2-MB/one-day capture
policy are unchanged. Only trigger paths are extended for the new regression.
The previously live 62f job is a different source and cannot accept this candidate.
No unchanged manual retry or deadline increase is requested or launched.

The three failed journeys still require the new source to pass the unchanged
complete SDK/UI gate. Real services, physical tracking, emergency Phone handoff,
push/support operational proof, booking/ride chat on iPhone and release remain
unverified. Both automated iPhone manifest entries stay pending. The partner site
adds one short local-only note without changing earlier flows, statuses, dates,
tours, galleries, blockers, updates or public access.
