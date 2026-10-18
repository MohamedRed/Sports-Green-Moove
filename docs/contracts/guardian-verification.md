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

## Integration Still Required

The service and rules have isolated verification evidence, not a deployed or
native manager/parent flow. Request/review screens, paging, interrupted-operation
recovery, child/team enrollment, team conversation access and personal emergency
contacts still require implementation and user-flow testing.

Existing booking/search guardian behavior is unchanged. No existing child or
membership record is migrated, promoted or rewritten. Future consumers must
explicitly check the current verified record for the exact club, child and
parent, plus their applicable current enrollment/relationship permissions.
Neither a legacy child array nor this verification alone grants another team's
messages. No automatic public-number or unverified-parent fallback is permitted.

These events are manager-verification audit events, not the separate tracking
guardian-consent evidence required by the release manifest.
