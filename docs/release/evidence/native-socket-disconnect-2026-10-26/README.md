# Copy Failure With Observed Socket Ownership

Native CI run 40397806734 at source 4dbffa47c8039ba463bf3d052fb9857496fb0048
finished in failure. The main job is 121835394777; artifact 12689795072 is
android-connected-ui-test-results. The eleven focused lanes passed. Ordinary
instrumentation completed 231 cases: 177 passed, 54 skipped, no failed cases.
Ordinary/component suite exits are zero; local replay exits one. This is not a
successful full gate, a completed remaining flow or a new physical-device pass.

The primary trip-consent-recovery copy exits one at 21:08:38.887Z. Its stderr ends
while building the file list. The original records now contain the socket-owner
instrumentation added at 4dbffa4, unlike the earlier ed851b7 failure:

- Before the copy: one observed same-user adb process, PID 3719/startTicks 51381.
  It owns the loopback 5037 listener, inode 16118, and an established loopback
  45447 to 5555 connection, inode 22879.
- After the failed copy: the same process/start identity and same 5037 listener
  remain; that established emulator connection is absent.
- The prior successful trip-consent-restart copy retained that original listener
  and established connection before and after its call.
- Later cleanup succeeds under the same server identity/listener but with a new
  established connection, 35653 to 5555, inode 40721. This is cleanup recovery,
  not an accepted retry or replacement for the primary copy.

Immediate stat/shell/sync diagnostics report device offline. Guest adbd reports
host-20 write failure/offline/destruction at 21:08:38.680-.681, followed by host-21
authorization at 21:08:39.427. Guest and host wall clocks are separate: do not infer
sub-millisecond cross-machine ordering. An ordinary MSG_PEEK process-socket line
alone is not evidence that the main TCP transport disconnected.

These observations support disappearance/re-establishment of the selected
transport without a sampled server-process or listener replacement. They do not
prove why the connection closed, exclude every intermediate event, or establish
a duplicate-daemon, emulator graphics, SDK version, application or storage cause.
The four historical daemon counters remain zero and are not a complete error log.
The newly added allowlisted daemon-event parser was not present in this run;
do not retroactively attach its output or claim it captured a live cause.

All eleven JSON/XML originals are copied without modification. Device restoration
and temporary installation-policy removal are verified. No raw daemon/process log,
credential, packet payload, new screenshot or video is accepted or published.
The earlier failed run and 1518a8b green baseline remain separate and unchanged.

Next diagnostic: bounded, allowlisted default host-daemon transport events, read
from its existing owned log. No added trace category, daemon restart, copy retry,
timeout extension or alternate capture path. AOSP's
[transport implementation](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/transport.cpp)
has distinct transport-read/termination/kick messages; classifying them is not a
claim that this exact running binary emitted one or that the cause is repaired.
