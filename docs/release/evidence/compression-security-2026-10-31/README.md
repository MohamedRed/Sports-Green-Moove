# Premature Response Compression Cleanup

Base source: `986f15535b4464ef3aeefc49c7ae0dff0aa4e20e`.
The CLI's existing hosting dependency resolves compression 1.8.1. A real
loopback HTTP response is interrupted by its client before response completion.
The actual gzip, deflate and Brotli streams remain undestroyed with no close
event: three failures. All four ordinary-response controls pass, including
byte-for-byte decompression and an unchanged identity response.

The maintained compatible 1.8.2 patch closes all three interrupted streams.
The same seven unchanged regressions pass, including normal payload preservation.
Snapshots are taken before the test harness's emergency teardown: explicitly
destroying leaked streams afterward never counts as successful library cleanup.
Each child has a 64 MiB heap and six-second deadline, omits private credentials
from its environment and uses only one ephemeral loopback listener. Listener
closure is independently checked before exit. This is a bounded stream-lifecycle
reproduction, not a memory-exhaustion attack or production exploit.

Only the compression lock entry changes, within the existing `^1.7.0` consumer
range. Its new destroy dependency already exists unchanged in the lock. No root
dependency declaration, override, runtime source, fallback, certificate policy,
provider setting or Terraform change is introduced. A normal clean install
replaces the unused vulnerable installed copy. Both native and web gates add
the real-response tests and evidence validation; all 111 original web workloads
retain their exact commands and environments.

All three workspace builds, 547 Functions cases, 208 rules cases and 78
payment/webhook cases pass. The first notification run has 18 passes and one
five-second concurrent-acknowledgement timeout. A fresh unchanged trial passes all
19 cases. Its source hashes match the base commit; no timeout is increased and
no scenario is removed. The original failing log and initial checksum index are
preserved alongside the follow-up. This does not diagnose or repair the timeout,
prove notification timing reliable, or establish a regression caused by this
development-only dependency. All eight emulator/service ports are independently
verified closed before retention and after the follow-up.

The same-day all-workspace audit changes from 39 findings (11 high, 28 moderate)
to 38 (10 high, 28 moderate), with no critical findings in either snapshot.
Compression disappears from that snapshot, but this is not a clean audit. The
older 30 October audit had fewer newly published advisories and remains dated
separately. Real payments, actual email/provider delivery, physical phones, GPS,
iOS, full Native CI and release readiness remain unaccepted. In particular, the
base-source main native job [124543847052](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41203498719/job/124543847052)
is terminal failure, independently of this security correction.

The public partner Site receives a concise security note and keeps its current
partial statuses, gallery, historical dates and public audience. No new media or
real account data is published.

Maintainer source: [compression premature-close advisory and fixed version](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95).
