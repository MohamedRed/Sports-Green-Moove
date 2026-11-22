# Native Replay Copy Failure, 20 October 2026

Source: `b158a75cbf8724e9e5ab59497ab321f5920aaa9d`.
Native CI run `39426320715`, main job `118639683801`, artifact
`12266683848` (`android-connected-ui-test-results`). The artifact was downloaded
through the authenticated GitHub CLI; individual retained file hashes are in
`artifact-sha256.json`. This is a selected negative-evidence bundle, not the full
artifact or a new physical-device, visual, payment or release acceptance.

The main job is terminal failure. Ordinary tests and component collection exit
zero; the local replay exits one. The retained ordinary XML has 172 entries,
no failures/errors, a successful named trip/month-control action regression and
an explicitly skipped paid search/booking trial. That regression proves the
named component actions, not a screen-reader audit or the complete booking flow.
`LocalTripChangeInputsFlowTest` reports one
passing native test, but its mandatory primary file transfer exits one and is
not complete. Read-only diagnostics observe the device offline and an adbd
transport write failure. These observations do not establish why the connection
dropped or prove a fix.

The later failure-cleanup copy succeeds. It does not replace the failed primary
copy, prove the unexecuted rest of the replay or create a successful final saved-
state report. Device restoration is independently verified with installation
policy restored and temporary administrator/component removed. All six separate
safety jobs in this run are terminal success; their full artifacts are not
independently validated by this selected bundle.

The earlier complete replay at `588fb21` remains its original dated success in
`../native-recheck-588fb21-2026-10-20/`. It is not evidence that this later run
passed. No existing capture has been relabelled with the newer run/date.
