# Terminal Native Recheck, e23809a

GitHub run 39797196374 / main job 119887388566 completes with failure at source
`e23809aca59def492636e7ad0a93f7df5e3b6ecd`. Artifact 12435492283 retains the
original reports. The ordinary XML has 195 cases: 145 passed, 50 skipped, zero
failures/errors. Both new support component cases pass (written replies/status at
narrow enlarged text, and failed-read/explicit refresh). Eleven focused lanes pass.
This is not full native, physical tracking or production acceptance.

The full isolated replay fails while collecting `trip-change-inputs` evidence.
The primary pull exits 1 at the beginning of an existing image transfer; the
separate failure-cleanup pull also exits 1. Read-only diagnostics report the
device offline. Guest transport logs contain a write failure and reauthorization.
Host process observations immediately before and after the primary pull contain
the same single observed adb PID/start time. Their bounded daemon-log signal
counts are zero. These observations do not identify the observed process as a
particular server, rule out every transport reset, or establish the root cause.
No alternate transfer, hidden retry, disabled test or invented completion is used.

The ordinary suite's device-policy restore receipt is independently successful.
It must not be promoted to a full-replay restore claim. The replay's failed
collection remains a failed collection. Physical support follow-up and its own
device/environment cleanup are retained separately.

`run.json`, `jobs.json`, `artifacts.json`, the original XML, transfer diagnostics,
status/ordinary restore receipts and full main-job transcript are unchanged.
The host-observation source is retained; `artifact-sha256.json` binds every file.
The support screenshot saved to a separate device directory was not in the
ordinary collector's allowlisted directory. Its output path is corrected in the
current test source for future runs; no missing image is invented for this run.
