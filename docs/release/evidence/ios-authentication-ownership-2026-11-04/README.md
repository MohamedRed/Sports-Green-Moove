# iPhone authentication ownership, 4 November 2026

Local, controlled-gateway regression proof only. No real SDK sign-in, rendered
authentication UI, actual process kill, tracking teardown or release acceptance.
Android and iPhone remain in release scope.

## Reproduction

The original AppState at `91f9677b42ce0d6b9fdb537c244eb24208d78edb` starts
sign-in, receives sign-out, then receives the delayed sign-in completion. The
controlled gateway mutates its simulated provider identity before delivering that
completion. The old implementation restores both the visible session and provider
identity and performs seven later private reads. The candidate restores neither,
cleans the simulated identity a second time, and performs no private reads.

`reproduction.swift` is the common entry point. The baseline uses the original
AppState; other Foundation dependencies and controlled gateways use the candidate
source. It excludes the new AppState authentication extension. The candidate
defines `AUTH_OWNER_CANDIDATE` to inject a memory policy; the baseline initializer
has no such parameter. Both binaries compile with Swift 6. The raw comparison
output, including its final blank line, is retained without editing.

## Ownership And Durable Policy

One authentication intent owns the session. Identity-changing operations are
serialized until their callbacks and required SDK cleanup finish. Logout and task
cancellation invalidate late completions. Guarding only the visible session is
insufficient because provider state can already have changed before delivery.
Failed cleanup blocks new login and exposes an explicit retry, never a completed
logout claim. Read-only restoration errors allow explicit retry without silently
discarding an otherwise valid accepted account.

Before identity mutation, a dedicated local file records a pending logout policy.
Only an owned, accepted login commits permission to restore. The record contains
only a schema version and boolean, never identity or credentials. It uses atomic
write plus file synchronization, iOS file protection and backup exclusion for its
dedicated directory. Missing, unreadable or unknown-version records never grant
permission to restore cached SDK credentials. **Migration effect:** an existing
installation without this record must explicitly sign in once. No legacy-session
fallback is introduced. Store/controller recreation tests exercise this policy;
they are not native process-death or locked-device proof.

## Checks And Limits

`native-checks.txt` records the real AppState compiled in the Foundation-only
checks with controlled callbacks: duplicate intent denial, all four gateway
methods after logout, cancellation with late success/error, partial provider
failure, cleanup failure, storage read/write/commit failure, explicit recovery,
read-only restore retry and file-policy recreation. Social methods are fake
contract coverage only; OAuth remains deferred. UI fixtures inject their own
volatile policy rather than altering the normal application file.

The complete native SDK build and rendered tests must run on this new source.
The earlier seven-test success at `5582299` is immutable historical proof, not
acceptance of this change. Profile logout remains unwired until location/tracking
teardown is safe; real profile identity, signup/role provisioning, child flows,
physical tracking, safety audits and the remaining release gaps stay open.
No new media, accounts, provider calls, infrastructure or audience changes.

Web Integration Smoke runs the new contract/evidence tests in its existing iPhone
step. Both web events and the iPhone workflow include the new test path. Original
workloads, budgets, deadlines and no-upload policy are unchanged.
