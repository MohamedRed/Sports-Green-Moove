# Notification Acknowledgement: Local Checks

23 October 2026. Implementation source `b0677594a01d754b1b7cd18559c7639e5bdf50c5`.

Generic booking/ride/membership alerts previously had no acknowledgement action.
The Android inbox now provides an explicit per-notification read control. The
authenticated callable verifies both the originating account and notice owner,
updates only `read` and its first server-owned `readAt`, and replays without
rewriting content or the timestamp. Missing and foreign notice IDs have the same
response. Direct client writes are denied, including forged dates and unread
reversal. Reading an alert does not acknowledge a chat message, alter a chat's
unread count, accept a booking or consent to a trip change.

Executed evidence: 17 real Firestore-emulator callable/transaction scenarios,
two security-rule cases and ten Android state/receipt JVM tests all pass. The
completed root Node run passes all 1798 tests, including nine added capture-failure
harness cases. The three new Compose cases and screenshot collection compile;
they have not executed in this local evidence. The broad backend unit suite
also passed 394 tests and Android JVM suite passed 514, but those broad totals
are not claimed by this focused bundle's retained XML.

The UI waits for an exact server receipt, blocks double taps, supports explicit
retry of the same notice after an uncertain response, merges independent server
confirmation, and ignores stale results after disposal. Test-harness preparation
failures are recorded in `summary.json`, not treated as executed product failures.

No new phone trial, screenshot, push delivery, iOS verification, production
deployment, production mutation or release acceptance is claimed. Actual push
token registration and dispatch are still absent from the application sources;
persisted inbox alerts are not evidence of delivery to a phone.
