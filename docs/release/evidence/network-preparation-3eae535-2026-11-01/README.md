# Independent Chat Network Recheck, 1 November

At 3eae535 the focused native chat case passes with the unchanged 31-file test,
fixture, transport and runner source inventory. Its original instrumentation,
primary capture copy, stored two-message/two-notification verification, service
disposal, restored device policy and independently observed host exit are retained.
The observed sequence includes Wi-Fi, exclusive cellular handover, no network,
restoration, explicit send retry, reply read and owner-private draft recovery.
It is simulation on one disposable hosted emulator, not physical-radio evidence.

The earlier 8369af5 trial is retained as a genuine preparation failure: one native
case fails its 30-second initial-network wait, before any disconnection or send.
It reaches the conversation over functioning Wi-Fi, but no cellular callback arrives
and no default data subscription is selected. Its cleanup copy does not replace a
passing flow or primary copy. Device policies and owned emulator disposal still pass.

Before app installation, the failed device already lacks a default data selection
and its carrier loader is still bound to its no-SIM configuration. The passing
device already has a default selection and loaded configuration at that point.
Later, the failed device reports a configuration bundle and sent change, yet still
has no default data selection. Configuration presence is therefore not selection
proof. The logs do not establish why the initial setup differed between devices.

Both original artifacts are bound to their API-returned archive digests, exact
producer jobs and source commits. No deadline, radio setting, default selection,
test assertion, retry policy, production endpoint or product code was changed.
No new public screenshots, videos or phone dates are added. The physical chat
confirmation-loss evidence remains independent and unchanged.

This bundle accepts only the scoped passing native case. It does not accept the
whole native gate, stability across devices, root cause, post-commit loss, real
push delivery, physical tracking, production deployment or release readiness.

## Other Checks At This Head

All 11 independent native safety cases passed in run 41360242235, but its main
job 125008878853 failed during the primary `trip-change-schedule` evidence copy
(status 1) after that one instrumentation case reported `OK (1 test)`. No retry
copy is substituted and no full-matrix success is claimed.

Web run 41360242279 attempt 1 received a runner shutdown signal. Its targeted
job rerun, attempt 2 / job 125014008538, also failed: the phone-proof test process
received SIGKILL and the job reported cancellation. The available annotation
does not establish why it was killed. The same three chat test files pass locally;
that does not convert either failed remote attempt into a pass. Their original
GitHub logs remain authoritative. No test deadline, assertion, or CI gate was
relaxed to obtain the scoped native result above.
