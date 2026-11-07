# iPhone Permission Build Failure, 4 November 2026

The approved capture run `41901262613`, job `126823997145`, is terminal `failure`
at source `a23cb9d67f6163156150dbfd320aff7e7ae95835`. It uses the approved
50-minute public job limit. The build step runs from 20:03:30 to 20:38:48 UTC,
then fails in `ActiveRidePermissionGate.swift:144` because generic result `T`
cannot be inferred for `withCheckedThrowingContinuation`. This is a compiler
failure, not another deadline cancellation. Underlying build slowness is unproven.

All UI execution, capture collection and upload steps are skipped. The artifact
inventory contains zero entries. No new screenshot is captured, retained or
accepted. Disposal succeeds. `terminal.json` preserves the original run response;
`compiler-error.txt` is an unchanged selection from the downloaded job log. Its
full-log digest and exact selected line ranges are in `summary.json`.

The candidate explicitly declares `CheckedContinuation<Void, Error>` at the
actual permission bridge. The operation's result, permission policy, duplicate
guard, manager request and continuation ownership are unchanged. No test is
skipped, no permission is simulated in production and the deadline stays 50 minutes.

`node scripts/qa/check-ios-permission-continuation.mjs` extracts the entire actual
method unchanged into a controlled MainActor fixture and compiles it with Swift 6,
complete strict concurrency and warnings as errors. Its typed bridge, duplicate
denial, successful completion, cancellation and reuse pass; see `bridge-check.txt`.
The fixture has a synthetic manager and no Apple permission APIs. It is not a
complete coordinator, SDK or phone test. The new early iPhone CI step checks this
previously unexercised bridge before the expensive SDK-linked build; web contract
tests validate its source and workflow coverage.

The candidate still needs an SDK-linked build and all original fixture UI tests.
No automatic capture retry is dispatched, no extra storage/cache is added, and
this record does not accept native media, real permissions, physical tracking,
full sign-out or release readiness.
