# SDK Termination Did Not Resolve Cleanup

The original independent Android case passed in 85.614 seconds. It checked that
a retained capture starts tracking, a future capture prevents startup, a valid
retry clears the previous error, and signing out stops the service. Its original
marker also confirms that pending writes completed and the test Firestore client
terminated before instrumentation ended.

The host still failed to delete its fixture: the local Firestore emulator raised
`StreamTransportClosedException` / `Stream is already completed` while notifying
a closed listener during the cleanup commit. The sanitized original emulator
logs, transcript, primary transfer receipt and four captures are retained here.

This is a negative end-to-end result. Client termination did not fix the observed
server error. The application assertions are evidence only of this synthetic
local case, not successful cleanup, physical tracking or release readiness.
