# Focused Capture Failure At 5d34c0f

The full main native job passes at this immutable source, but the separate
team-read-components job fails and its required safety aggregator fails with it.
The retained PR rollup is terminal and must not be presented as a green full gate.
The earlier fccd8ef complete green check remains a separate historical result.

The original three fake-gateway team-read cases and three session-exit cases pass.
The following eight native alert-opening and four platform cases also report OK.
Their primary `adb pull` then fails and is explicitly incomplete. The original
copy record reports a host transport termination; the guest diagnostic reports a
write failure and temporary offline state. The underlying disconnect cause is
unproven. Reconnected diagnostic output and partial files do not repair the copy.
Old team-read files present in that partial directory are not accepted as new
alert screenshots. No screenshot is published from this bundle.

Device policy/package restoration and emulator-process exit are independently
retained; the original notification permission is restored despite the incomplete
trial. The source archive, exact instrumentation transcripts, selected original
JSON reports and original remote artifact digest retain these boundaries.
The complete artifact stays in the private diagnostic workspace; it is not a
new public gallery asset. No fallback, resend, longer deadline or SDK change is
introduced, and none of these framework cases proves real push delivery.

Separately, the local Node suite has one false assertion failure: `/5557/` scans
the whole serialized diagnostic and matches `monotonicMs: 225.555708`, while its
only observed socket uses ports 5555 and 48350. The original failure excerpt and
deterministic predicate reproduction remain retained. The test now checks socket
port fields structurally and separately checks private strings. Regression cases
accept colliding clock digits but still reject actual unrelated ports. Runtime
observation is unchanged; this test correction does not explain or repair the
remote disconnect. The focused corrected file passes 29 local tests.
