# Android Native CI recheck · 16 November 2026

Native CI [run 43927447715, attempt 2](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43927447715/attempts/2)
completed successfully at source `4c19872d44773f4da4734626704883c69d23551b`.
The complete Android Compose UI job and the aggregate of eleven focused
emulator cases both passed.

- [Full Android UI job 133675763260](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43927447715/job/133675763260)
  completed at 23:31 UTC. Its report lists 299 component cases passed, 55
  intentional skips and zero failures. The isolated replay passed 37 groups
  comprising 40 native cases.
- [Focused chat recovery job 133675764602](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43927447715/job/133675764602)
  retained the offline draft, confirmed the explicit retry after host-controlled
  reconnection, and verified two stored messages with zero duplicates. The
  two messages comprise the retried message and its peer reply.
- [Focused aggregate job 133680682897](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43927447715/job/133680682897)
  required every isolated case and its cleanup to pass.

The [first attempt](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/43927447715/attempts/1)
remains in the run history. The same-source rerun added evidence of a full pass.
Intermittent emulator transport and cellular setup behavior still warrants
separate diagnosis. No new media accompanies this result.

Both downloaded job artifacts match the archive sizes and SHA-256 digests
reported by GitHub. See [archive checksums](original-archives.json).

The release manifest still requires Android and iPhone device tracking,
system phone handoff, operational notifications, and sanitized safety-audit
evidence. See the [device protocol](../../real-device-test-protocol.md).
