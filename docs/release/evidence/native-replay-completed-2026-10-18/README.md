# Completed Isolated Native Matrix

[Native CI run 39139971649](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39139971649)
finished successfully at source `570ac17c2ce79e6899564a47be4233fe70e200e8`.
The ordinary suite's original XML contains 124 cases: 93 passed, 31 intentionally
skipped and no failures/errors. SHA-256:
`4ee9c05ae6667fbcc5ce5eed9800d880bfe723992bff8ddc992a7f9aebea3571`.

The independent isolated replay `a3a5f34d7657adbba4973414bc4f9663` completed at
`2026-10-18T15:44:32.747Z`. Its original `results.json` records all 33 planned
coverage groups passed, covering 35 native cases. All 27 original instrumentation
transcripts are retained: the combined opening group contains nine cases and
each remaining transcript one. All 12 primary transfer receipts report a
successful, uninterrupted copy for this same run. There is no failed primary
copy being replaced by a later cleanup success. Native suite exit statuses are
ordinary=0, component collection=0, isolated replay=0; store restoration verified.
`artifact-sha256.json` protects the 43 original report/transcript/receipt bytes.

## Scope

The replay covers the existing isolated booking/driver/ride/chat/membership,
response-loss, network recovery and trip-consent/draft stages, including their
persisted-state checks. Its limits still apply: mock positions and pre-granted
emulator permissions; no physical GPS tracking, real payments/refunds, push
delivery or production data. Four search cases use explicit callback fixtures;
the multi-seat case is an SDK scenario, not a native multi-seat booking request.
The report retains the individual step methods and boundaries.

This complete local matrix is not every requested product flow. Parent-child
verification request/review screens, team enrollment/chat, personal emergency
contacts and dialer handoff, payment restart/recovery and real-provider/device
scenarios remain unfinished or unverified. Neither iOS device checks nor the
separately approved real-map integration was requested by this CI run. Existing
dated galleries remain unchanged; no new screenshot/video is published merely
because a transcript passed. No release-manifest item is accepted.

## Stability

This is one successful run after retained failures. It does not repair or explain
the earlier focus loss, process stops, PixelCopy timeout or directory-list copy
failures. Those reports remain at `../native-input-focus-2026-10-18/`,
`../local-payment-layout-2026-10-18/` and
`../native-transfer-interruption-2026-10-18/`. New failure-only file-sync probes
were committed after this source; this successful run does not execute or
validate those probes on a device. Repeatability and any future failure still
need investigation without suppressing assertions or retrying failed transfers.
