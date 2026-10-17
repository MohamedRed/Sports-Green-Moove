# Native Departure Time And Address Safety

Commit `146240ead726f53523699f7d2f88193d0f002f0a`,
[Native CI 39047271866](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39047271866),
completed all 26 isolated native/backend cases and groups in run
`2dae75bc30e1a74213d7aa90cd652ee8` at 2026-10-17 16:16:10.935 UTC. All required
checks were green at this implementation head; iOS was intentionally skipped.
The ordinary suite separately declared 103 cases: 82 passed, no failures/errors,
21 conditional local-backend skips. The required suite statuses are `0`, `0`, `0`.
Fifty-six original files and hashes are retained in `completed/`.

The new native input case passed in 35.662 seconds. It used the real Android
time picker to change departure from 09:00 to 10:00 UTC (11:00 to 12:00 Brussels)
and the price from EUR 2.50 to EUR 4.00. Typing unconfirmed origin and destination
text separately showed the correct validation and disabled proposing. Explicit
"keep current place" actions restored the original coordinates; no successful
lookup or changed route was substituted. The parent opened their own booking,
saw both departure times and prices, accepted and saw one agreement out of one.

The driver then requested the actual route calculation. With live route access
disabled in this isolated setup, the app showed its route-unconfirmed error and
exposed neither a quote nor an apply button. Independent host checks required
exact persisted proposal terms, driver/parent/booking identities, unchanged
original trip and booking snapshots, scoped parent reads, outsider denial,
zero saved quotes and exactly three unique notices for the two accounts.
`trip-change-inputs-ui-stage.json` is the narrower accepted stage receipt and is
retained verbatim inside the separate full `results.json`.

Both original 1080x2140 captures were visually reviewed. The parent capture shows
11:00 versus 12:00, both prices, `1 / 1`, the recorded agreement and the explicit
not-yet-applied message. The driver capture shows the proposed details, the route
error and refresh action with no apply control. These are approved only as local
time-consent and unavailable-route illustrations. They preserve synthetic QA
titles and unavailable-map labels, not map/provider/physical-device evidence.
The portal also retains the earlier reviewed four price-consent and three
cancellation images at their original dated paths.

The complete replay retains all earlier groups, including the two-parent price
confirmation, refusal, withdrawal, cancellation, membership, keyboard, account
switch, strict dual-transport disconnection/restoration, response-loss recovery
and independently stopped process-restart checks. All 18 instrumentation
transcripts and seven named evidence-copy receipts passed. A successful copy in
this run does not explain or repair the earlier intermittent copy failure;
[that failed run and the earlier completed 25-group proof](../local-trip-consent-native-2026-10-17/README.md)
remain unchanged.

Date-picker changes, desired-arrival editing, successful address lookup/route
changes, route calculation, application after agreement, consent recovery after
process death, historical review, real payments/refunds, physical tracking and
six safety-audit records remain open. Team chat additionally awaits the enrollment
approval decision and its authoritative membership/guardian lifecycle. No
production app deployment, new provider outcome, paid resource, infrastructure
change or release-manifest acceptance is claimed. The overall goal stays active.
