# Native Team Registration Journal, 1 November 2026

Twenty-seven actual JVM cases exercise a private, durable registration journal,
its file reconstruction and the authenticated callable boundary. The complete
722-case Android JVM suite passes. App and instrumented-test APKs compile; no
instrumentation or physical device was run for this result.

The journal reserves increasing revisions before asynchronous token retrieval,
persists unconfirmed requests for exact retry and clears them only after a
matching acknowledgement. Account epochs reject delayed callbacks, including a
return to the same account. A consumed callback cannot change an existing
revision's payload or reactivate a confirmed request. Account changes clear local
confirmation and require actual provider token deletion before another token can
be accepted. These are model tests, not an implemented SDK logout sequence.

The installation proof and pending token are in app-private no-backup storage.
Confirmed state retains only a token hash. Atomic synchronized writes survive
reconstruction without resetting corrupt state. This is single-process locking,
not a cross-process durability claim. The strict response parser rejects another
account, altered revision, extra fields, malformed flags and failed calls.

The callable gateway and journal are not yet attached to application lifecycle,
token refresh, permission or sign-out callbacks. No provider token was acquired,
deleted or sent, and no server dispatcher or notification tap was implemented.
No closed-app delivery, physical, iOS, production or release requirement is
accepted here. Existing phone evidence, gallery dates and partial statuses remain.

`review.json` binds sources captured before/after the successful build and both
compiled APK digests. All JVM reports are retained with the host name redacted;
their case counts and zero failures/skips are independently checked. Checksums
cover every artifact. The build transcript redacts the home directory and trims
trailing whitespace; the unmodified log remains in the private trial directory.
Source snapshots live in the shared content-addressed
archive. The original private build log is not published on the progress Site.

Web Integration Smoke validates this retained result alongside the original
server-registration and alert coverage. Native CI discovers the Kotlin tests;
its eventual result must be reported separately from this local run. No new
infrastructure, paid provider request or screenshot policy change accompanies it.
