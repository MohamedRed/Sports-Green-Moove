# iPhone Search Safety And Callable Boundaries, 4 November 2026

The `ef9f0e6` SDK-linked build fails before UI execution. The previous two support
diagnostics do not recur; four unique diagnostics remain in booking submission,
inbox and ledger responses. The summary retains their source locations, terminal
job, successful simulator disposal and the private original failed-step log hash.
Absence of the old diagnostics is not an app-build or support-flow pass.

The candidate shares a typed owned-call boundary across support, inbox and ledger
reads. It checks cancellation and current account before/after the asynchronous
call and decodes Sendable models inside the callback. Booking submission creates
its validated wire dictionary inside the continuation, preserving request identity,
terms, receipt validation and lost-response recovery. No SDK range, language mode,
deadline, retry policy or original UI assertion is relaxed.

Search consent now starts false and resets atomically when the child or tracking
selection changes. Changed form/place inputs revoke results. Prepared requests,
late responses and booking actions are scoped to their exact account, form and
route. Account changes also clear private place selections and lookups. The former
search implementation is moved out of `AppState.swift`, not left as a second path.

The included sanitized local logs pass. The native command now compiles actual
AppState/search sources in Swift 6, exercises the search model and app-state guards,
and retains all previous native logic checks. App-state cases use the explicitly
unconfigured gateway, not a real account or provider. The separate strict signature
compile checks the real gateway source against test interfaces; it is not a real
SDK build or a reproduction of the newer compiler's diagnostics. Source hashes
bind the candidate files to these scoped local observations.

Two added UI cases cover consent, child/tracking changes and stale seat results.
They have not executed yet. All five original fixture tests remain; the search
identifier case now gives explicit consent and runs a search rather than accepting
preseeded results. Fixtures remain isolated and make no provider requests.

The public note adds no media or flow acceptance. All existing flow dates, statuses,
captures, tours and prior updates remain. Full SDK compilation, UI behavior,
physical safety scenarios, real payment/operational evidence and release acceptance
remain open on both Android and iPhone. No infrastructure change requires Terraform.
