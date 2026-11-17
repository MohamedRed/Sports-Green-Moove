# Original Post-Rotation Observation Failure

The fifth local trial failed at recovery after receiving a second synthetic point.
Its first three captures, original failed instrumentation and cleanup failure are
retained; no positive report was produced. Read-only SDK logs reported a killed
database connection after activity recreation. Local runtime construction resolved
a database instance again after the emulator configuration had already run.

The local runtime now retains and injects the exact configured database instance
across recreation. The actual subsequent independent trial confirms a new point,
pickup, resumed dropoff, completion and history. The failed original remains
negative. Separately, long host child commands now run asynchronously so existing
administrative SDK clients are not starved during instrumentation and cleanup.
