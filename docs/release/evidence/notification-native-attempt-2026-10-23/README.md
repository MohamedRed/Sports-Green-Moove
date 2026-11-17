# Native Notification Attempt, 23 October 2026

Terminal Native CI run 40014947968 on `3a5b5d3d` failed. All eleven focused lanes
passed separately. The complete lane did not finish; neither its markers nor the
successful cleanup copy replace its missing primary collection and final checks.

The four notification component cases passed, including the date-bearing status
matcher regression. This corrects the earlier `87082b10` exact-string assertion,
which stopped before any read action. Explicit `substring = true` is required by
the Compose assertion API; no app behavior was changed for this matcher correction.

Both connected notification instrumentation stages executed. Their retained
before/stop/after markers have distinct PIDs and a no-process boundary. The first
independent checkpoint protects 176 records. The collector then rejected the new
`notification-read-restart` phase before issuing its primary copy because that
phase was missing from its explicit allowlist. The final saved-state verifier
and completed stage marker were not reached. The allowlist is corrected in later
source with a focused subprocess regression; that correction needs a fresh run.

The ordinary matrix recorded 157 passed, 52 skipped and one failure among 210
discovered cases. The failure is in the screenshot capture for
`TripChangeFlowTest.agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement`:
Compose `captureToImage` / `forceRedraw` times out after 2000 ms. This is not
reported as a failed business assertion or attributed to a proven graphics cause.
No timeout, retry or capture fallback was added.

Policy, package and launcher restoration validate. The host observer reaches
`gone` without requesting process signals or device commands. No new native media
from this incomplete run is published. The separately recorded physical read
trial has its own report and does not establish process death.

All original retained files are checksummed. Application release approval,
physical production tracking, push dispatch and real payments remain open.
