# Schedule Capture Transfer Recheck - 23 October 2026

Native CI run 40027788818 at 3413b579 is terminal failure. It predates the new
booking-request notice change. All 159 ordinary cases pass, with 52 explicit
skips and no ordinary failure. All ten focused jobs and their aggregate pass,
including the startup job that failed in the preceding run. This does not prove
the earlier service-disconnection cause or physical tracking readiness.

The main replay passes LocalTripChangeScheduleFlowTest but fails its primary
trip-change-schedule capture copy (status 1). The subsequent failure-cleanup copy
pulls 102 files successfully; it does not replace the primary phase. Sanitized
diagnostics actually observe the device offline for three read-only commands.
The device log reports host-18 write failure/transport teardown and a subsequent
host-19 connection. Host process observations retain the same process ID. These
facts establish the observed interruption, not its underlying cause, a server
restart, a system update or an app defect. No alternate copy path or retry is added.

Policy/admin, local-package and launcher restoration are verified. The owning
host observes the target process gone. Cleanup is not app-flow acceptance.
Original transfer/diagnostic reports, instrumentation, ordinary results and
artifact metadata remain checksummed. No new public media, physical tracking,
production mutation or release requirement is accepted.
