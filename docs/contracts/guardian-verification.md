# Parent-Child Verification

The owner selected the club manager as verifier on 2026-10-18. This is separate
from approving a child's team enrollment. A parent who is also a club manager
cannot verify their own relationship. An administrator claim alone does not
grant verification authority.

## Service Boundary

`transitionGuardianVerification` accepts the strict fields `clubId`, `childId`,
`parentUserId`, `action`, `requestId` (UUID), and `expectedRevision` (zero for a
new request). It returns only `verificationId`, `status`, `revision`, `replayed`.

- The parent can request or withdraw only their own relationship. A request
  needs an active club membership and an existing declared child link. That
  declaration is eligibility to request verification, never verification itself.
- Verify/refuse/revoke require the club-manager claim and a currently active
  management membership for the request's club. Approval additionally rechecks
  the parent's membership, child declaration and non-archived club.
- Withdrawal remains available after the parent leaves the club. Revocation
  remains available when the club is archived. Neither operation grants access.
- Only a requested record can be verified/refused; only a verified record can
  be revoked. Withdrawal closes a requested or verified record. Reopening a
  refused/revoked/withdrawn relationship requires a new parent request.
- Every transition checks the stored revision in a transaction. The same actor
  and operation UUID can be replayed only with the original payload. A replay
  returns current state, so replaying an old approval cannot revive a revoked
  relationship. New conflicting decisions cannot both commit at one revision.

`guardianVerifications` stores the club/child/parent tuple, explicit status,
revision, actor and timestamps. Its deterministic ID hashes a structured tuple,
not an ambiguous concatenation. `guardianVerificationEvents` is an immutable,
transactionally written operation/audit history. Direct client writes, including
administrator clients, are denied. The parent and the currently scoped manager
can read these private records; foreign managers and unscoped role claims cannot.
No contact numbers, child names or documents are copied into these records.

## Private Lists And Manager Review

`listGuardianReviewClubs` requires the manager claim and lists only canonical,
currently active management memberships, even for an account also holding admin.
`listClubGuardianVerifications` rechecks that exact club's current management
membership inside the same read transaction as each page. Admin alone cannot list.
`listMyGuardianVerifications` requires parent and restricts results to that UID,
including closed requests and requests from a former club. There is no client
supplied parent ID. Inputs are strict and all pages scan at most 20 records with
one lookahead. Cursors bind the account and list/club, not an authority grant.
Each page reauthorizes access. Single equality plus document-ID ordering uses
existing automatic indexes; no new infrastructure or Terraform is required.

Rows contain the canonical tuple ID, revision/status, nullable display names and
currently allowed actions. No email, phone, document or child-profile payload is
returned. Invalid verification records fail the entire page closed. A child's
current name is not revealed through a historical request after its declared
parent link is removed. Manager rows also hide current parent/child names when
the parent no longer has active club membership. History ownership is not a
grant to read someone's current profile. A child's declared guardian list is
only request eligibility, not approval. Missing current
membership, removed child declaration or archive removes grant actions; removal
actions remain available. Managers never receive actions for their own requests.

The management website now has a separate parent-verification section. Managers
confirm verification, refusal or revocation after reviewing the named pair and
club. Unnamed pairs cannot be newly verified through this screen. Operations use
the displayed revision and a new UUID. There is no optimistic verified state or
automatic decision retry. An uncertain reply clears stale rows and requires a
fresh read; a confirmed decision with a failed refresh is labelled separately.
Account changes discard old screen results. A replayed result displays its actual
current status rather than assuming the original decision is still in effect.

## Parent Requests

`listGuardianParentOptions` accepts `kind` (`children` or `clubs`) and an optional
cursor. It requires parent, uses only the authenticated UID, and returns up to
20 scanned entries per page with an explicit continuation. Children are the
currently declared links, not manager-verified relationships. Club choices are
canonical, active memberships in non-archived clubs. Missing names remain null,
not invented identities. Cursors bind UID and choice kind; filtered empty pages
can still have a next cursor. No new composite indexes are used.

`getMyGuardianVerification` accepts only the club and child IDs. It reads the
canonical tuple and current eligibility in one transaction. An eligible absent
record has explicit null status/revision zero. Absence from a partial list is
never treated as revision zero. An existing owned request remains readable for
withdrawal after membership/link loss; this does not reveal a child's current
name after its link is removed or re-enable grant actions. Corrupt records fail
closed. Reads never write a request or audit event.

The Android Groups screen links to the parent request screen for accounts with
the parent role. History, children and clubs have explicit paging. A selected
pair or history row is freshly read before its request/withdraw confirmation.
The displayed revision and a UUID bind each submission; the SDK also rereads
before writing and the service transaction remains the final race fence. No
optimistic verification, automatic write retry or client approval action exists.
Unknown replies clear actionable state and require a fresh read. Account changes
close the old state and the SDK checks the explicit owner UID before/after calls.
Reopening the app reads history/current state instead of restoring capabilities
from a cached screen. This does not grant team-chat or emergency-contact access.

## Completed Local Parent Stage

The scoped parent app/SDK stage completed on 2026-10-18 at 17:47:29 UTC in
run `39150235114`, source `5d89788e2b4db440ad65c1575cc072acdf3f8030`.
The original device marker, five reviewed captures, successful primary-copy
receipt, passing transcript and independently checked eight audit events are
retained in `local-guardian-parent-native-2026-10-18`. Request, cancellation,
refusal/reopen, verification, activity recreation, withdrawal/revocation and
account isolation passed. This does not prove full process death or a physical
phone. The whole run failed later on other cases and device restoration checks.

## Integration Still Required

The service/rules and management review have isolated evidence. The Android
parent screens have unit/build checks and the separately completed local-SDK
stage above. Full process restart and physical-device replay are still required.
The iOS parent screen, child/team enrollment, team conversation access and
personal emergency contacts still require implementation/user-flow testing.
No production deployment or physical-device verification is implied.

Existing booking/search guardian behavior is unchanged. No existing child or
membership record is migrated, promoted or rewritten. Future consumers must
explicitly check the current verified record for the exact club, child and
parent, plus their applicable current enrollment/relationship permissions.
Neither a legacy child array nor this verification alone grants another team's
messages. No automatic public-number or unverified-parent fallback is permitted.

These events are manager-verification audit events, not the separate tracking
guardian-consent evidence required by the release manifest.
