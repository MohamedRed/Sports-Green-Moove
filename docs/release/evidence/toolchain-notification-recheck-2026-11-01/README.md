# Transfer Comparison And Notification Removal Recheck

On source `a55ed57`, both explicit account-free comparisons pass all 32 primary
transfers with exact-byte integrity and owned-file cleanup. The ordinary control
uses 37.0.1; the alternate uses the official digest-pinned 36.0.2 archive. Both
record emulator 37.2.13, their requested/installed toolchain and distinct binary
hashes. Their run and artifact IDs/digests are in `review.json`. The preceding
84cb6b2 control's six passes and seventh failed copy are retained separately.
Neither version is established as the cause; the product test toolchain is not
changed. These are generated-file copies, not recovered application captures.

The 84cb6b2 focused team-read job passes three earlier read components and all eight
alert-opening cases, then fails one of four platform cases. The failure is the
immediate active-notification assertion after requesting removal (line 70), not
a failed open, permission request or provider receipt. The original transcripts
remain unchanged. Permission restoration and independent package/policy cleanup
succeed; this does not turn the failed job into a pass.

Android 15's [notification-service implementation](https://github.com/aosp-mirror/platform_frameworks_base/blob/android15-release/services/core/java/com/android/server/notification/NotificationManagerService.java)
schedules cancellation on its worker handler. An immediate read is therefore not
an acknowledgement. The candidate observes posting and removal using coherent
snapshots and a five-second monotonic deadline. It still requires exactly one
generic team notification, its immutable private intent, removal of all team
notifications and survival of the unrelated control. Neither posting nor removal
is repeated to rescue failure; an absent acknowledgement fails explicitly. The
production implementation, four case count and outer instrumentation deadline
are unchanged. This source inspection is not the exact device service bytecode
or an independently reproduced minimal scheduling experiment.

The candidate compiles with unchanged source hashes in an isolated local build;
it has not yet executed. No new media is published. Historical phone dates, tours,
partial statuses and the public audience are preserved. The separate 93d9138 full
gate still fails its emergency-contact evidence copy. No whole-gate success,
physical device, push delivery/tap, production deployment or release requirement
is accepted. Real tracking, safety audits and operational notification evidence
remain open.
