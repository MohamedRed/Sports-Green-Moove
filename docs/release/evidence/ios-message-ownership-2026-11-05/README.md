# iPhone Messages And Rating Ownership

Checked locally on 5 November 2026. This is controlled logic/signature evidence,
not an iPhone SDK build, rendered screen, provider transaction or physical test.

The exact `loadInbox` and `submitReview` methods from source `61c3f20` restore old
inbox content and an old rating notice after a simulated account-generation
change. The reproduction extracts both unchanged method bodies into controlled
types; it does not execute SwiftUI, authentication or a real sign-out. Its source
hash, script, projection and original local output are retained.

The candidate binds the actual screen and requests to immutable AccountAccess.
Inbox, continuation and rating work retains its lease until settlement. Forty-two
delayed success/error cases cover logout, same UID, other UID, role roundtrip,
screen close, background and task cancellation. Stale content and feedback are
discarded; unsettled work blocks a new account's dispatch. Current requests,
displayed trip/review identity, pagination, duplicate exclusion, acknowledged
rating suppression, explicit retry and malformed/foreign replies are checked.

An unconfirmed rating cannot be resent until an explicit inbox refresh succeeds.
The receipt must match the requested ride, author and recipient, as in the
existing server contract. The explicit refresh control is source-wired; the
existing fixture case adds refresh and acknowledged-suppression assertions.
Its SDK/UI execution is still pending. All eleven fixture cases remain required,
with no additional screenshots, storage, retries or relaxed deadlines.

The unchanged source-bound earlier device passes remain historical evidence,
not proof of this candidate. Full conversation interaction, native sign-out,
physical tracking, actual Phone handoff, push delivery, urgent support and audit
requirements remain open. No provider requests, production writes, real accounts,
phone sessions, map requests or payments were performed by these local checks.

Web Integration Smoke includes the new evidence contract. Native CI runs the
actual state checks and the existing bounded public iPhone workflow still builds
the full app and runs every fixture. No Terraform change is needed: this changes
application ownership and test coverage, not infrastructure.
