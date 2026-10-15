# Local Conversation Integrity Checks

Date: 2026-10-15. Sanitized output: `results.json`.
Run: `54aa2eecc338f92cf50fef28c321a3c6`.

The guarded local service suite passed all 12 groups on working changes following
`6eb9fbe`. It used an ephemeral demo project and synthetic accounts. No live
account, provider payment, billing resource or production record was modified.

The new `chat-delivery-safety` group reproduced a defect in the prior send path:
three simultaneous retries stored three messages. That failed baseline is retained
as `baseline-failed.json`, not accepted as passing evidence. The corrected path
stores one message and one recipient notification in a transaction, with a
sender-scoped UUID. Reusing the identity with different content is refused.

The passing checks cover authorized conversation metadata, outsider/anonymous
denial, input limits, sender-scoped IDs, exact read acknowledgements, atomic
rejection of mixed invalid read batches, repeated reads, legacy messages and
preservation of a later incoming message's unread state. Separate unit tests
cover deterministic identity/content matching; access-rule tests forbid direct
message creation, editing, deletion and forged read acknowledgements.

The Android implementation now opens a thread, streams server snapshots, loads
older history, sends replies and preserves pending send identities across retries.
Compilation and service tests alone do not prove those app screens. The native
conversation harness has been added; its actual run and reviewed captures must
be recorded separately before the partner site claims app-level success.

## Limits And Deployment

These results are service checks, not app/physical-device evidence. Real phone
delivery, push, offline behavior and live-provider integration remain unverified.
The existing inbox discovers threads from its latest 50 messages; only the thread
itself supports older-history pagination. iOS conversation UI is not included.
Starting a new conversation from a booking has no app entry point yet; the native
test starts from a seeded received message and must not be described as initiation.
Legacy keyless sends remain compatible but are not idempotent. Legacy random
notifications are not blanket-marked read.

The message index and callables are checked in, not deployed. Deploy them before
the new Android client; see `scripts/qa/README.md`. No Terraform resource is
created: the index uses the repository's canonical Firebase index configuration.
Web Integration Smoke already covers the changed Functions, local QA scripts,
indexes and evidence paths and runs the service suite; no trigger change is needed.

## Native Run Not Accepted

[Native CI 38795959058](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38795959058)
on `8a5f934` reached the new local chat case but stopped at its first text entry:
the composer was still disabled during server loading. The test now waits for
the actual enabled input instead of assuming that a visible input is ready.
No new conversation screenshot or app-flow success is accepted from that run.
