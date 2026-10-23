# Native Replay Of Payment-Fee Head - 23 October 2026

Source: a2f273fb45d0f5f8bd882f9f7a3ebeb49e5513a1. Native CI run
40023614141 is terminal failure, not a completed release or full replay.

The ordinary instrumented batch passes 159 cases with 52 explicit skips and no
failures. The new unrelated-booking component and the identity-scoped driver
approval both execute successfully; the subsequent nine-case batch passes.
The old approval wait therefore no longer describes this replay's point of stop.
This does not establish the sole cause of the preceding failed trial.

The main replay later passes the trip-change input case but fails its primary
capture transfer at `trip-change-inputs` (status 1). Its bounded client trace ends
at `pull: building file list...`. The subsequent failure-cleanup transfer succeeds
with 100 files. It does not replace the failed primary phase or establish its
cause. No retry, alternate capture transport, provider fallback or acceptance
rule is added. No new captures are published from this run.

Nine focused safety lanes pass. The separate native-startup lane times out at
LocalNativeTrackingStartupTest line 85, waiting for pickup UI after resume.
Its failure tree displays "Position GPS indisponible pour le suivi de course."
The instrumentation also retains a suppressed ApiException 20 reporting a lost
Google Play services connection due to service disconnection, from the scheduled
mock-location feed. This does not prove a system update, package replacement,
application crash or the underlying cause. Startup completion is not accepted.

Both failed devices verify policy/admin restoration, local-package removal and
launcher restoration. Each owning host records the target process gone. These
cleanup observations do not turn either failed phase into successful flow proof.

Original command reports, instrumented transcripts, sanitized failure tree,
ordinary results, source snapshots and artifact metadata are checksummed. APKs
and videos are not added. No physical GPS, real payment, production mutation,
provider delivery or final release requirement is accepted.
