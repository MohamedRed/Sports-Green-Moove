# Team Conversations

## Agreed Audience

On 2026-10-16 the product owner selected members of one team, not all members
of the club, as the audience for group messages. This is a product decision,
not evidence that the flow is implemented or tested.

The owner also confirmed that parents of children enrolled in that team are
included. A parent's entitlement must come from an authorized, active guardian
relationship and the child's active enrollment in the specific team, not from
club membership or editable profile fields. Included parents can read and send
messages and receive the same unread/read state as directly assigned members.

Current conversation sources support bookings and ride sessions only. Team
conversation entry, message authorization, and the corresponding app flow remain
to be implemented and verified together. The isolated enrollment service below
does not yet grant message access. Club membership alone must not grant it.

## Ownership Boundary

Local rules and signed-in transport checks reproduced and fixed a cross-club
team update at `local-team-ownership-2026-10-16`: manager updates now retain the
stored club ID and require authority over that existing club. This does not
implement team conversation access. Direct create/delete and administrator
capabilities keep their prior policy, so identity reuse and the complete
enrollment/guardian lifecycle need server-owned handling before chat is wired.
The enrollment identity fence below now handles server-created team and child
identities; chat still does not consume it. See the dated release evidence for
the unchanged red/green reports.

## Required Verification

- Two active members assigned to the same team can open the conversation,
  exchange messages and receive the corresponding unread/read state.
- A verified parent of an actively enrolled child has that same access without
  requiring a separate direct team assignment. An unrelated parent does not.
- A parent linked only to a child in another team in the same club cannot
  discover, read, send to, or receive notifications for this team's conversation.
- Removing the guardian relationship or the child's enrollment revokes access,
  including historical reads and notifications, unless another current direct
  assignment or qualifying child independently still grants that team's access.
- Multiple qualifying children do not duplicate the parent's conversation,
  messages or notifications. Losing one qualifying link must preserve access
  while another active link remains; losing the last must revoke it.
- An active member of another team in the same club cannot discover, read,
  send to, or receive notifications for that conversation.
- Members of another club, signed-out visitors and arbitrary participant IDs
  supplied by a client cannot obtain access.
- Requested, refused, inactive or removed team membership does not grant access.
  Revocation must apply to historical reads, new sends and notifications, not
  only to the app's visible conversation list.
- Team assignment and membership changes are authorized on the server. Editable
  profile or child fields are not sufficient proof of message entitlement.
- Account switching does not expose another member's messages or drafts.
- Existing booking/ride conversations remain functional and retain their
  separate participant rules.

Tests must use two teams in one isolated club, enrolled children, their verified
parents, an unrelated parent and an outside account. Retain
denial evidence as well as successful exchanges. Do not reuse a booking exchange
as proof of team access or publish a non-functional team-message button.

## Enrollment Approval

On 2026-10-17 the owner selected the club manager to approve people and children
joining a team. Approval must require current management authority over the
team's stored club, not a client-supplied club ID. An application administrator
role alone does not grant this team-enrollment approval capability.

Only an approved, active enrollment can grant the team's conversation access.
Parents qualify through an authoritative guardian relationship to an approved,
actively enrolled child. On 2026-10-18 the owner selected the club manager to
verify parent-child authorisation as a separate decision from team enrollment.
An enrollment approval alone must not verify a parent; parents cannot approve
their own relationship, and a manager of a different club cannot verify it.

The existing client-declared `children.guardianUserIds` array does not establish
this verification. Server-owned verification transitions and private records now
have 20 isolated service checks; see `guardian-verification.md`. The parent's
native request/revoke replay is separately recorded; none is deployed or connected
to team-message access.
A verified link must
not grant access to another team or club without a current approved enrollment.
Requests, refusals and removals retain the denial and
revocation requirements above. The team chat flow remains unimplemented. On
19 October, the parent app on an isolated Android phone and the actual club
management website passed seven enrollment checkpoints together, including the
child's request/approval. See `phone-team-enrollment-2026-10-19/README.md`.
No connected team-conversation result is accepted; no production record is approved.

## Android Enrollment Screen Source

The app now has a Groups entry for eligible adults to select a club/team, request
their own enrollment or choose a currently verified child, review current status
and confirm a request/withdrawal. Selection uses the paged
`listTeamEnrollmentOptions` callable, not editable profile/roster arrays. Four
component cases now have separately executed and reviewed evidence in
`team-screen-export-2026-10-18/completed/`. Sixteen unit cases and 12 isolated
directory groups are retained in
`local-team-enrollment-native-2026-10-18/README.md`.

The connected native case passed ten checks with an SDK manager peer; its original
report, successful primary transfer and five captures are in
`local-team-enrollment-native-2026-10-19/`. The separate physical-phone/management
journey above used UI actions for both sides and independently checked seven
stored transitions. Its parental link was prepared through authenticated fixture
transitions, not through that manager's parental-verification screen.

This is still not a completed team flow. Owned-request history after lost
eligibility/retired teams, full process restart, physical parental revocation,
other devices/platforms and group chat remain open. Backgrounding clears private
choices and selection; no automatic resubmission occurs after an unknown write.
Team conversation access is unchanged and the new client/services are not deployed.

## Isolated Enrollment Service

`getTeamEnrollmentView`, `requestTeamEnrollment`, `transitionTeamEnrollment` and
`listTeamEnrollments` now have 20 isolated transport scenario groups plus six
domain unit cases. See `local-team-enrollment-2026-10-18/README.md`. This is a
backend-only evidence, not a deployed or end-to-end native flow. The separately
executed screen/phone results above do not change the scope of these service checks.

Team identity binds the stored club and immutable server document creation time,
including nanoseconds; child enrollment also binds the child document's server
creation time. Editable `createdAt`, roster arrays and profile declarations do
not establish enrollment. Deleting/recreating a team or child cannot inherit its
old approval. A name edit preserves identity; transferring clubs does not.

Requests bind the exact viewed team identity, enrollment identity, revision and
actor-scoped operation UUID. Adult subjects are auth-bound; a child request also
requires the exact current manager-verified parent tuple, declared link and both
canonical active club memberships. Public/private clubs accept eligible requests;
missing, unknown or archived states do not. Child and mixed child/parent accounts
cannot manage enrollment. A manager needs a current active management membership
in the record's stored club, not only a role claim or a supplied club ID.

Status transitions are requested -> approved/refused/withdrawn, approved ->
revoked/withdrawn, and closed -> newly requested. Approval rechecks eligibility
transactionally. It does not verify guardians or change user roles. Stale or
conflicting decisions cannot both commit; old operation replay returns current
state without restoring an earlier approval. Removal/refusal remains possible
after team retirement; no new grant is allowed.

Only the requesting account withdraws its request; another verified parent may
read an eligible child's enrollment but cannot withdraw the first parent's
decision. Adult withdrawal remains available after club membership loss. A child
enrollment withdrawal after approval requires the requester's current authority;
manager revocation remains available. This conservative withdrawal policy does
not create or remove the child's separate guardian verification.

Records and operation history are private server-only collections, including for
admin clients. Views fail closed on malformed stored identity/version. Manager
pages scan at most 20 records plus one lookahead; cursors bind account and current
team identity. Missing labels remain null, and stale child authority hides labels.
No message access, notifications, public roster or production migration is added.
