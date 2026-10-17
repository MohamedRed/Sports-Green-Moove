# Local Android Trip-Change Verification

## Executed Service Checks

`services.json` is the original successful isolated service run
`c3c68ee9bdc74be604c3248adf880746`, completed at
`2026-10-17T10:35:49.656Z`. All 24 groups passed. It exercises the service/contract
changes in `c7f8ec045535f8a3034a638261e6a17d6ef7077b`, using only
`demo-sgm-local-qa`, ephemeral test credentials and the existing egress guard.

Two distinct parents confirm the exact proposal, while the trip and bookings
remain unchanged before explicit application. Refusal preserves the original
trip without cancelling the booking. The fresh assertions check caller-only
request identity metadata, affected-reservation review links, exclusion of a
later booking from an older proposal, request-bound quote responses and explicit
server expiry. It also resolves an absent and then persisted proposal through a
driver-owned read-only endpoint; parents, outsiders and another driver are denied.
Application and supplement groups independently inspect persisted
records. Route calculation is injected and payment metadata/events are synthetic:
no real payment, refund, map-provider result or phone behavior is established.

## Executed Unit Checks

`unit-summary.json` is derived from the actual Gradle JUnit reports on
`c7f8ec045535f8a3034a638261e6a17d6ef7077b`: 196 cases, zero failures/errors/skips.
The three original trip-change reports in `unit/` contain 31 of those cases:
seven strict payload/response tests, six date/price/address-draft tests and eighteen
state/lifecycle tests. The successful command also compiled Android instrumented
tests; compilation is not screen execution.

The focused cases cover exact request binding, one decision per parent, separate
agreement/application/payment states, unchanged retry identities after unknown
responses, expiry without automatic retry, stale revisions, closed-session late
callbacks and preservation of a proven receipt after refresh failure. Untouched
instants preserve fractional seconds and offsets; invalid Brussels DST times and
unresolved addresses cannot become a proposal.

The added cases reproduce a persisted proposal whose acknowledgement and list
refresh were both lost. Explicit refresh resolves the exact saved request without
another write. A failed resolution cannot fall through to a preview or mutation.
All 240 Functions unit cases also passed in the local command; the raw focused
Android reports, not a reconstructed test transcript, are retained here.

`rules.json` retains a separate fresh 100-case passing Firestore rule run. Client
writes to the protected proposal, quote, balance and payment-ledger records remain
denied. This does not represent a production rules deployment.

`before-resolution/` preserves the earlier successful 24-group service run and
193-case unit summary with its three original 28-case focused reports. Those
bytes are historical and are not overwritten by the new run.

## First Screen Run

`first-screen-run/general-ui.xml` preserves the original report from commit
`c7f8ec045535f8a3034a638261e6a17d6ef7077b`, Actions run
`39025520745`. The ordinary suite declared 95 cases: 74 passed, two failed and
19 conditional isolated-backend cases were skipped. Five of seven trip-change
component cases passed. The remaining two failed at the initial error wait and
a missing scroll ancestor in the standalone reservation test host, respectively.
`first-screen-run/summary.json` records those boundaries. The complete isolated
24-group native replay never started. These are not the older cellular-network
preparation failures and do not prove seven passing component cases.

The corrected host matches the app's scroll container. Both price inputs now
use the existing actual-keyboard readiness protocol before the submission action;
the original error deadline and physical action remain unchanged. Successful
compilation and unit tests do not establish that this fixes the failed screen case.

## Executed Component Screen Checks

`results.json` and the original `component.xml` record all seven trip-change
component cases passing on `781b925b00e3bdf72c0e7b5e63cf07f9e2cf873b`,
Actions run `39026693680`, completed `2026-10-17T11:05:22Z`. These use an
in-memory gateway with synthetic terms, not a connected application project.
They cover the owning-driver proposal, large-text parent acceptance, refusal,
reservation entry, separate explicit application with an outstanding supplement,
retained application success after refresh failure and proposal recovery without
another write. This is not a multi-account native/backend replay.

The broader ordinary suite **failed**: 75 passed, one failed and 19 conditional
isolated-backend cases were skipped. The failing cancellation case exposed an
incorrect scroll on its fixed dialog action in the newly shared helper. The
corrective helper leaves layout-specific action scrolling with each screen test.
No complete isolated native replay started in this run. Passing the seven new
cases does not turn Native CI green.

All five original `compose-captures/` PNGs were visually inspected. They show
black native-map areas and are **not approved for portal publication**. They are
retained unchanged as diagnostic evidence; no map or route was painted in. The
next screen run collects both Compose and actual native-display images so the
capture method can be compared with what the device really renders.

## Still Open

The complete multi-account native/backend replay, pending-edit process-death
recovery, declined/withdrawn review history, real address/map usability, actual
payment/refund settlement and push delivery remain open. Physical tracking and
the six real safety-audit event requirements are unchanged. No application,
Functions, rules, infrastructure or provider deployment was made to production.
The overall user-flow goal remains active.
