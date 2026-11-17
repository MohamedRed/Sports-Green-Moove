# Primary Transfer Failure With Surviving Host Processes

Run 41206766250, job 124553316302 on source `1683526`, passes 28 exact generated
file pulls and fails the 29th primary attempt. Three planned attempts never run.
The failed command exits 1 after 47 ms with 643 bytes of unclassified output.
The original receipt remains failed; no retry, alternate transfer, app install,
account, map request or payment is used. All 32 original JSON members and their
ZIP are retained. The provider digest and size are independently verified and
each extracted member is compared byte for byte.

The new snapshots now run during a real failed trial. The exact host emulator
PID 4056/start ticks 19617 is still present afterward, with the same four console
and device-connection listeners. Its established peer socket has disappeared.
Host connection server PID 4224/start ticks 20618 and listener inode 28271 also
remain, but its matching peer socket has disappeared. The host trace adds one
payload-read termination and one transport-read failure. These observations
precede the failed remote cleanup, not a later intentional emulator shutdown.

This distinguishes the sampled host-process presence from the observed loss of
the connection. It does not establish uninterrupted host execution, guest boot
identity, guest daemon state, who closed the socket, a crash, a product defect,
or any specific SDK-version/renderer cause. Host emulator and Android guest
daemon are separate components in the [official architecture](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/android15-s1-release/README.md).

Fourteen host connection-tool processes are observed before the sequence and one
afterward. The older snapshot has no parent/state fields, so it cannot classify
those extra processes as zombies, identify their parent or prove a process leak.
The next diagnostic reuses the existing Linux stat parser to retain only state
and parent PID before/after descriptor observation. It reads no arguments or
environment, runs no new device command, changes no transfer count/deadline and
performs no retry or restart. These additions were not present in this retained
run and are not yet accepted as exercised on Linux.

Remote generated-file removal and absence checks fail. No independent runner
disposal receipt is claimed. The fixture is synthetic and belongs only to the
disposable CI test device; no real account or production record is involved.
The earlier 24-pass/25th-failure and 32-pass reports remain dated separately.
Neither a full native gate, successful evidence copy, physical tracking, guest
lifecycle diagnosis nor release readiness is accepted. No new media is published
and the partner Site stays public with its old galleries and flow dates intact.
