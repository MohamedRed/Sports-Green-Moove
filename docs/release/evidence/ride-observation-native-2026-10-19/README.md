# Independent Foreground Ride Observation Trial

The original local native command completed on 19 October 2026, run
`4edae1803eb9accc6d48881739f0a330`. One instrumentation case passed in 123.241
seconds. Its primary evidence transfer, independent persisted-state verification
and isolated fixture cleanup completed before the positive report was written.
All owned backend emulators subsequently stopped. The disposable app and test
package were removed and the owned Android virtual device stopped after review.
No administrative device permission was needed on this local device.

The actual app signs in as the parent. A separate authenticated SDK peer acts as
the driver; it does not replace the parent session or exercise driver screens.
Two synthetic position writes, one pickup, one dropoff and one completion traverse
the real local SDKs, authentication, callable handlers and database rules.
The app ages a received position for 90,725 real elapsed milliseconds, warns
without another packet, and removes the warning on the next received point.
Rotation, remote passenger updates, lifecycle pause/resume, remote completion and
completed history are asserted. The parent signs out at the end.

Eight unedited captures were visually reviewed, including landscape. Fresh and
recovered captures legitimately have identical bytes: both show the same freshly
received position before passenger changes. The stale capture differs from both;
the test's elapsed wait and ordered peer operations prove the intervening trial.
The map is unavailable in this isolated build. No map movement is demonstrated.

`ride-observation-results.json` binds exact source bytes retained in the source
archive, the original successful instrumentation transcript, device marker,
primary transfer receipt and capture hashes. This was an uncommitted candidate
based on `b0946aa`, not a completed current-head full-suite or release run.
`artifact-sha256.json` binds retained artifacts, not a replacement transcript.
Raw JUnit reports retain all 379 Android unit and 343 Functions unit cases with
zero failures or skips; `root-tests.txt` retains the 747-case Node check output.

Earlier startup, landscape-interaction and post-rotation connection failures are
retained separately. The connection correction keeps the explicitly configured
local database instance across activity recreation rather than resolving another
unconfigured SDK instance. The host now awaits long child commands asynchronously
so its existing administrative clients can service their connections and cleanup.
No failed assertion, timeout or original failure was removed to obtain this pass.

This scope does not verify physical GPS, provider delivery, actual network loss,
locked/background tracking, child-device identity, automatic ride discovery,
multiple-ride selection, map coordinates, payments, safety-audit exports, iOS or
store review. All corresponding final release requirements stay open. Deploy the
matching backend before distributing the new client outside local testing.
