# Historical Gate, Complete Input Inventory

This normalized v2 report reuses the already completed successful d56 workflow
`42111120252`, job `127539367855`. No workflow, phone, provider call or capture is
started again. The original eleven passing cases and empty artifact inventory
are preserved. SHA-256 values additionally bind every tracked iPhone build input,
including resources, to that exact Git source. Textual source/workflow originals
remain in the shared content-addressed archive.

The new validator accepts this result only for the matching historical tree.
The current ride-chat input helper differs, so it explicitly rejects inheriting
this pass as current acceptance. Regression cases replace record checksums and
still reject fewer/skipped/duplicate cases, unfinished or failed jobs, missing
build/disposal, unexpected captures, wrong source, missing inputs, changed
resources and changed workflow jobs. Labels alone cannot satisfy the gate.

Historical failure tests retain their exact original evidence and negative
assertions. Only their perpetual assertions about the mutable current manifest
are replaced with validation of the current source-bound proof. The earlier
seven-case index and shutdown-pending index remain immutable. The gap reporter
now uses the current verified iPhone entries, never a manually selected stale
automated index, while preserving all unrelated cumulative evidence.

No physical, live-service, notification, safety, emergency phone handoff or
complete release acceptance is added by this historical report.
