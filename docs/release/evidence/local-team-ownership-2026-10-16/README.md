# Team Club Ownership

Local verification on 2026-10-16. This is a prerequisite access-control boundary,
not an implemented or accepted team conversation.

## Reproduced Failure

The rule at baseline `f9a590faf09f8a004e788a3c275b4b306438235d` authorized team
creation and updates against `request.resource.data.clubId`. An active manager
of club A could update an existing club B team by supplying club A as its new
owner. The same error affected replacement and merge writes. A manager of both
clubs could also reassign the existing team through an update.

`rules-before.json` is the unchanged local rules-test report: 14 cases, 10 passed
and 4 failed. All four failures say an expected denial actually succeeded. They
are authorization failures, not syntax, connection or fixture setup errors.

## Fix And Verification

Creation and update are now separate rules. A manager's update must retain the
existing `clubId` and be authorized against that stored club. Existing scoped
create, rename, replacement and deletion, public discovery and explicit global
administrator authority remain available. Administrator moves were permitted
before this change and remain a separately privileged operation.

`rules-after.json` retains the exact same 14 team cases, all passing, plus the
existing 3 membership and 10 trip-capacity cases: 27 passed, zero failed. The
suite checks patch/replacement/merge takeovers, a dual-club manager, foreign
creates/edits/deletes, missing claims, forged/disabled/non-active management
membership, anonymous writes, removal of the ownership field and allowed edits.

The complete Firestore, Realtime Database and Storage regression command also
passes: `full-rules.json` retains all 40 successful cases in the five rules files.

`services.json` is an unchanged complete isolated service replay:

- Run `a6a896d95309b5fa78e559296b41a65a` at `2026-10-16T14:11:25.194Z`.
- 19 required groups passed; all 18 earlier groups remain mandatory.
- `team-ownership` signs in actual synthetic accounts and performs direct local
  Firestore REST PATCH, whole-document replacement, atomic commit and DELETE.
- Ten prohibited mutations return 403 / `PERMISSION_DENIED`. After each, an
  independent privileged read requires the complete foreign team to be unchanged.
- A real active membership in both clubs does not authorize reassignment. After
  disabling that extra membership, edits to its team are denied despite the
  still-valid global manager claim. The manager's own-club rename still succeeds.

No new screenshot or recording is claimed: this is rules/transport/persisted
evidence, not a management-screen or phone replay. The private portal retains
its earlier, separately proven membership UI captures and partial status.

## Scope Still Open

This fix has not been deployed to production. No live users, roles, data,
provider configuration, billing, cloud resources or access were changed. The
existing rules are the versioned infrastructure artifact; no Terraform resource
change is required. Backend CI runs the new rules test; Web Integration Smoke
also runs it and the new required service group.

Direct team create/delete and administrator capabilities intentionally retain
their previous policy. This is not proof that a team ID cannot be deleted and
recreated. Before introducing group-message entitlement, the full authoritative
team/enrollment/guardian lifecycle must handle removal, historical access,
notifications and identity reuse together. Editable child `teamIds` and proposed
guardian IDs are not sufficient authorization.

Team assignment, active child enrollment, verified guardian relationships,
deduplication across multiple children, revocation after losing the last valid
link, team chat discovery/history/read/send, and app/account-switch scenarios in
[the team conversation contract](../../../contracts/team-conversations.md) remain
unimplemented or unverified. Existing booking/ride chat evidence is not team chat
evidence. Physical tracking, real safety events, live payments and push remain
separate open release requirements.
