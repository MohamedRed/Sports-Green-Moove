# iPhone MVP Baseline, 4 November 2026

The owner confirmed that the MVP includes Android and iPhone. No device, safety,
operational or store requirement is removed. `summary.json` retains the local
logic result and a dated startup observation of the separate hosted build.

The original sanitized `native-checks.log` passed at source `6948862`, with the
SHA-256 recorded in the summary. This checks Foundation logic on macOS, not a
compiled iOS application, UI, provider connection or physical iPhone.

The first SDK-linked verification at `c1c2fa4` generated the project, passed its
native logic checks and created a simulator. Retain the original startup snapshot
separately from the later terminal failure. At 12:46:28 UTC, the run failed with
exit 65 while compiling `FirebaseSupportGateway.swift`, before UI execution.
Xcode 26.6 and Firebase 12.19.3 reject non-Sendable request/response values crossing
the continuation. The summary retains both compiler errors, the private original
failed-step log hash/size and successful simulator disposal. Raw logs stay private.

The candidate correction passes string-only request parameters and decodes the
response into a Sendable support model before resuming the continuation. It keeps
both identity fences and cancellation checking. No concurrency setting, SDK range,
deadline, retry policy or fixture assertion is relaxed.

The local strict Swift 6 signature-contract compile passes against explicit test
interfaces. It is not an actual SDK build or a reproduction of the newer compiler's
diagnostics; only the full unchanged SDK-linked workflow can verify the correction.
Its existing five UI tests, if reached, remain fixture-screen proof only.

Source review at `6948862` identifies incomplete conversation actions, emergency
contact management/handoff and consent reset. These findings are not executed
phone results. The existing five identifier tests cannot prove full transactions
or close these functional gaps, even if they pass.

The new public progress note records the failed first trial and changes no flow
status, test date, media or tour.
Its iPhone blocker records incomplete conversation and emergency behavior without
publishing raw logs, example phone numbers or internal implementation names.
