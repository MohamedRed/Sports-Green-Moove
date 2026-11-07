# Test Runner Security, 30 October

Base source: `8fb8731bf129e041144602932d814e54f8cf6be7`. This changes only the
Functions development test runner and its dependency graph. Production source,
runtime dependency versions, Android/iOS code and provider settings are unchanged.
No production deployment, real payment, map request or phone flow is accepted.

## Reproduction And Removal

Three bounded child-process probes reproduce inherited filename, worker arguments
and environment options in the installed Tinypool 1.1.1. Each uses only checked-in
benign local workers: a different return label or an environment marker. No network,
private file access, persistent write or account is used. Child environments omit
credentials. All three regression assertions fail before the change; a fourth
installed-version/graph assertion also fails, but is not a fourth exploit.

Vitest moves from 3.2.6 to the supported 4.1.12 maintenance release. This removes
Tinypool and the superseded worker implementation rather than overriding an
incompatible dependency. The maintained mocker fixes are included. The same three
probes then report that the legacy dependency is absent; they do not claim to test
every option of the replacement worker implementation. The fourth guard checks
the actual installed versions against the lock and refuses any retained legacy pool.

The full workspace audit changes from 33 findings (two critical) to 30 (zero
critical, twelve high, eighteen moderate). Vitest, its mocker and Tinypool no longer
appear as findings in the after-snapshot. This is not a clean audit or proof that
production endpoints were exploitable. Audit scope includes development packages.

## Compatibility

The new runner passes 547 backend unit cases, 208 authenticated permission/rule
cases, 78 payment/webhook cases and 19 notification-read cases. Payments use test
fixtures and mocked provider boundaries; no actual money or provider delivery is
proved. The root Node snapshot passes all 3,000 cases before adding this report's
validator. Functions, admin and website build, and a clean install succeeds with
the repository's normal npm 10.9.4. None of these results establishes physical
tracking, multi-phone operation, iOS execution or complete release readiness.

The initial npm 10 dependency-resolution attempt fails inside Arborist before
changing the lock. npm 11.6.2 resolves the maintained runner without disabling peer
validation or forcing a version. Sixty unrelated peer-classification-only edits
are removed mechanically; unchanged package entries retain their original metadata.
The normal npm 10 clean install verifies the final lock. The initial
rule command also exits before executing tests because its PATH selects an older
Java despite JAVA_HOME. Its original failed output remains separate; the subsequent
run selects Java 21 explicitly and executes all 208 cases.

The original before/after locks, audit snapshots, test output, build output, source
snapshots and endpoint closure receipt are retained by SHA-256. The local factory-
device comparison attempted separately this turn cannot start due to disk space;
its newly created AVD is deleted. A warm local network bootstrap is not treated as
a clean first-boot comparison or a repair of the intermittent cellular preparation.

Publish one concise security-progress note without new media, preserving every
historical phone/gallery date, partial flow status and the public audience. The
separate native run on the base source does not cover this dependency update.
The full current native gate and all existing release/physical requirements remain
separate from this test-tool change. No Terraform infrastructure changes are needed.

## Base Native Gate

Run `41063277585` on the exact base source is terminal failure in main job
`124088103015`, at the Android Compose UI step. All eleven independent focused
lanes, including the network recovery case, succeed. The uploaded main artifact
`12981493483` has digest
`sha256:b7c2a869420e4d248e8f4be4c4323ffae71a93fd63a180e17963be97331f54f4`.
The first download returns an egress-limit error and the separate failed-log
request is unavailable. A later bounded download succeeds without rerunning tests.
The retained original matrix reports 257 observed cases: 202 passed, 54 skipped,
one failed. All four new diagnostic calibrations and all three team components
pass. The failing `TripChangeFlowTest.largeTextParentSeesBothVersionsAndAcceptsWithoutApplying`
throws `Failed waiting for PixelCopy!` at its capture, not the blank-image guard.
The named rejected-team-image collector correctly reports `not-observed`.

The primary observation records one SDK invocation, a 1069 ms primary duration,
and a 259 ms sample in the callback latch wait while the main thread is in
`nativePollOnce`. Its heartbeat observations end at 489 ms, with maximum delay
30 ms. The scheduled 1200/1600 ms samples cannot execute before this invocation
finishes. These observations neither prove a renderer defect nor exclude all
later main-thread delay. No capture deadline, image acceptance or retry changed.

Component copying separately exits zero. The integrated replay later passes its
one parent-confirmation case but its subsequent primary-file copy exits one.
The original receipt records a connection-terminated-read-failed event during
that copy; it does not identify the disconnect cause or a missing product image.
There is no completed forty-case replay. This is not the earlier 1cc8f12 cellular
preparation failure, and no new phone or renderer repair is accepted.

## Maintainer Sources

- [Inherited worker options](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3).
- [Inherited per-task filename](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr).
- [Removal of the old pool architecture](https://v4.vitest.dev/guide/migration.html).
- [Maintained 4.1.12 release](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12).
- [Manual mock registration fix](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8).
