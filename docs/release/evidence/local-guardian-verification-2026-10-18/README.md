# Local Parent-Child Verification Services

`services.json` retains a completed isolated run of 20 checks, including real
signed-in callable HTTP requests and Firestore REST/rules reads, queries and
denied writes. The report contains its run ID, exact time and source-file hashes.
It contains no fixture passwords, access tokens, child contact details or real
customer data. External provider requests and production writes are both zero.
Run `72295138fe071852baa6b6bc7fbdbc31` finished at
`2026-10-18T15:01:06.999Z`; its source hashes matched the working source before
commit. The report SHA-256 is
`8fa675af9ea9f6b281c0cd07bdb76514fc375cce7aa0c13faae7dd0595fa1431`.

The checks cover a declared parent request remaining unverified, signed-out and
extra-field rejection, another parent's operation, self-verification by a
parent/manager, a foreign club manager, administrator-only and unscoped manager
claims, lost-reply replay, changed operation payloads, stale and concurrent
decisions, a revoked manager membership, parent withdrawal after leaving a club,
revocation/new request, replay of an old approval, removed child links, an
archived club and corrupt stored data. Direct reads/queries remain private;
direct verification/audit writes are denied. Existing children, clubs, teams,
memberships, notifications, bookings, sessions and trips are unchanged after
the checks restore their deliberate isolated fixture alterations.

Local validation also passed all 288 function tests (five new domain cases) and
all 202 existing Firestore/Realtime Database/Storage rules tests. The latter are
regression checks; the new guardian-rule operations are exercised by the
20-check HTTP suite. CI runs that suite independently in Backend CI and Web
Integration Smoke.

This is server-side foundation evidence, not a native parent request/manager
review screen, team enrollment or team conversation. Personal emergency-contact
editing and dialer handoff are not implemented by this change. No new device
capture, physical tracking, tracking guardian-consent event, store-review item or
release evidence is accepted. Nothing has been deployed to production.

Existing club/team ownership and native membership evidence remains retained at
`../local-team-ownership-2026-10-16/` and
`../local-membership-refresh-2026-10-16/` with its original dates and scope.
See `../../../contracts/guardian-verification.md` for the operation contract and
the remaining integration requirements.
