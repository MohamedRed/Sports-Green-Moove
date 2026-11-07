# Full Native Gate at a2e3e19 - 1 November 2026

Completed run `41325676113` fails. All eleven independent lanes pass, including
the synthetic-token connected sign-out. Ordinary instrumentation discovers 289
cases: 234 pass, 54 intentionally skip, one fails. The narrow exit capture and
pending-exit privacy case pass; the reviewed narrow image is retained here only.

The wide exit case rotates the device and checks landscape bounds but calls
`captureLocalUi` with its default portrait expectation. Its explicit orientation
guard rejects the actual landscape bitmap. This test-contract cause is known;
the candidate now passes the tested frame orientation. The shared capture guard
is unchanged. The corrected call has compiled locally, not yet executed here.

The connected replay also fails its `network-recovery` evidence copy (status 1),
then its cleanup copy (status 1). The preceding native network case reports
`OK (1 test)`, not accepted full business-state verification. The transfer cause
is unconfirmed. Preserve both original failure receipts; do not call this an
offline-message failure or replace it with the independent lane's pass.

Device restoration verifies cleanup. Raw ZIP digest matching is not performed
for this main artifact. No new Site media, real SDK delivery, physical validation,
capture-transfer repair or release acceptance is added.

## Later Transfer Triage

The retained primary receipt shows the same host daemon PID while its loopback
device socket disappears. Separate failure diagnostics report an offline device
and guest transport write failures. This establishes connection retirement, not
its cause or continuous guest-daemon execution.

The nearby `MSG_PEEK` close message belongs to app-process/JDWP metadata handling
in the [upstream source](https://android.googlesource.com/platform/packages/modules/adb/+/master/libs/adbconnection/adbconnection_server.cpp),
not direct evidence that the file-transfer peer closed first. That upstream blob
was inspected on 1 November; it is not matched to the installed guest build.
No downgrade, alternate transport, retry or inferred repair was introduced.
