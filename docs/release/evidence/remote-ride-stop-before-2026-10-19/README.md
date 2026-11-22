# Remote Completion: Original Negative Case

On 19 October 2026 the isolated Android case reached an active driver ride,
backgrounded the Activity, and used a second authenticated driver session to
perform pickup, dropoff and completion through the actual local callables.
The primary checkpoint confirms completion was acknowledged while the Activity
was stopped and the service was still running. The original test then failed
its unchanged 20-second service-stop assertion. This is not passing evidence.

The installed production service came from `d2b00e7`. It watched authentication
changes but did not subscribe to ride lifecycle changes. `source-hashes.json`
identifies its immutable source bytes and the original native case, retained in
the shared source archive. The test uses synthetic location input, not physical
background GPS. No production accounts, rides or payments were used.

The original transcript, partial transfer receipt, checkpoint, diagnostics and
sanitized local-service logs are retained. No positive report or completed
device marker exists for this attempt. Its baseline isolation was not independently
reported; do not infer that proof from the later successful attempt.
