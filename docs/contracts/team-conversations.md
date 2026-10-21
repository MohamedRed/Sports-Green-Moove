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

Booking/ride conversations retain their separate sources and participant rules.
Team-message callables have isolated server evidence described below. Connected
Android exchanges, multi-child access changes and durable draft recovery now have
local native evidence. Physical-phone team exchanges, iOS entry, unread/read
state and notifications remain unfinished.
The enrollment service alone does not grant message access. Club membership
alone must not grant it.

## Ownership Boundary

Local rules and signed-in transport checks reproduced and fixed a cross-club
team update at `local-team-ownership-2026-10-16`: manager updates now retain the
stored club ID and require authority over that existing club. This does not
implement team conversation access. Direct create/delete and administrator
capabilities keep their prior policy, so identity reuse and the complete
enrollment/guardian lifecycle need server-owned handling before chat is wired.
The enrollment identity fence below now handles server-created team and child
identities; the separate team-message service now consumes it. See dated evidence for
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
native request/revoke replay is separately recorded. The new isolated team-message
service consumes this verification; none is deployed to production.
A verified link must
not grant access to another team or club without a current approved enrollment.
Requests, refusals and removals retain the denial and
revocation requirements above. On 19 October, the parent app on an isolated
Android phone and the actual club
management website passed seven enrollment checkpoints together, including the
child's request/approval. See `phone-team-enrollment-2026-10-19/README.md`.
That enrollment trial did not test a team conversation. The later local native
conversation trials below are accepted only within their isolated scope; no
production record or physical-phone team conversation is approved.

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
eligibility/retired teams, enrollment-specific process restart, physical parental
revocation and other devices/platforms remain open. The separate group-chat
evidence below does not complete those enrollment requirements. Backgrounding clears private
choices and selection; no automatic resubmission occurs after an unknown write.
Booking/ride conversation access is unchanged; new team services are not deployed.

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
Enrollment APIs alone add no message access, notifications, public roster or
production migration. The separate team-message service below checks current
enrollment and guardian authority on every request.

## Team Message Service, 21 October 2026

The owner confirmed adults/verified parents only and history after arrival.
`getTeamChatMessages` and `sendTeamChatMessage` now recheck team, club, current
role profile, child-login association, active club membership and manager-approved
team enrollment within the same transaction as the message read/write. A club
manager does not gain chat access without approved team enrollment. Legacy
`membership.teamIds` grants no permission. A recreated team or child cannot
inherit its predecessor's rights. Eighteen isolated callable scenarios are
retained in `team-conversation-services-2026-10-21/README.md`.

For each eligible path, the admission boundary is the latest team approval,
current club-membership update, and, for a parent, guardian verification and
child club-membership update. If several currently eligible paths exist, the
earliest of their boundaries applies. Required timestamps must be present;
missing or inconsistent metadata is rejected, not replaced by a guessed date.
Each parent needs independent verification and club membership, regardless of
which parent requested the child's enrollment.

Messages use server commit timestamps. Every page retains the admission filter,
including tampered cursors. Cursors bind account, immutable team instance and
current authority versions; they are not credentials. Direct client reads and
writes are forbidden. History pages contain at most 50 messages. Authority
evaluation supports at most 200 approved enrollment records per team and rejects
larger teams rather than silently excluding participants. The query index is
declared in the existing Firebase index manifest; no new project is provisioned.

Every send requires a UUID. Transactional receipts bind it to sender, team
instance and body. Concurrent retries write once; changed content is rejected.
Old receipts cannot recover inaccessible pre-admission history. Authorization is
checked before returning any receipt. Child-login associations fail closed,
including incomplete association metadata or mixed child/adult roles.

Android source now contains the separate entry, scoped directory, thread,
per-account/team draft and foreground refresh described below. iOS entry,
unread/read state and notifications remain unimplemented. These server endpoints
alone do not prove a connected app flow or real-phone exchanges. Separate local
native trials below cover connected exchanges, multi-child/alternative grants
and cross-team isolation. Physical-phone, notification and unread/read-state
requirements remain open. Existing booking/ride conversations are unchanged.

## Android Conversation Screens, 21 October 2026

Eligible adults have a Messages > Teams entry. `listTeamChatOptions` transactionally
checks the current adult account and active club before scanning five records per
page. Each team is independently checked using the complete conversation authority.
An empty filtered page retains its continuation cursor. Club choices disclose only
current active clubs; team choices disclose only approved conversation access.
Names are nullable, never invented; missing names disable opening that row.

The native adapter binds every reply to the current auth UID, immutable team
identity and strict schema. Message pages expose the current access version,
sanitized author labels and operation UUIDs; the same UUID is stored with each
message and is used to acknowledge a pending send. No direct document read is added.

The thread clears private messages on background or a failed authoritative read,
refreshes every four seconds only while foreground, and resets loaded history when
the admission version changes. This polling is the primary team transport, not a
push-delivery claim. Drafts and uncertain send IDs are saved per account/team
instance; the shared booking composer retains its existing explicit-retry policy.

Three executed simulated component cases, six actual directory callable scenarios,
an eighteen-scenario message service recheck and ten native unit cases are retained
in `team-chat-components-2026-10-21/README.md`. The reviewed image allowlist excludes
one partial redraw. Later local native exchanges and account switching are retained
in `team-chat-connected-2026-10-21/README.md`; a separate eleven-checkpoint native
trial covers two children, revoked/renewed authority and two-team isolation in
`team-access-native-2026-10-21/README.md`. Manager fixture transitions use SDK calls,
not that manager's UI. No physical team-chat, production deployment, unread/read
state or notification delivery is accepted.

## Private Draft Persistence, 21 October 2026

A native trial reproduced unsent draft loss after a verified full process stop.
The original failure remains in `team-draft-loss-2026-10-21/README.md`.
The correction saves the body and pending operation UUID atomically in private,
backup-disabled app storage, scoped to auth UID, team ID and immutable team
instance. A malformed/read-failed record is an explicit retry error, never a
silently empty composer. A failed save keeps typed text visible and blocks
network send until the operation identity can be preserved. An uncertain send
retains that identity across restart; no automatic send or outbox is added.
Acknowledgement clears the saved draft only after durable storage succeeds.
Booking/ride composer behavior otherwise remains unchanged.

The unchanged three-method native trial passed on `eae2535`: two host-issued
stops verify no process remains, and three distinct process IDs establish the
two restart boundaries. The same parent recovers the unsent text without
retyping, one UI tap sends once and a separate driver SDK reads it, the next
process retains an empty composer, and another signed-in account has no parent
draft. Independent storage checks prove two seeded messages before send, three
after, exactly one parent operation and 158 protected records unchanged except
allowed sign-in timestamps. Owned backend disposal and device-policy restoration
are retained in `team-draft-native-2026-10-21/README.md`, job `119345801082`.

Ten focused JVM state tests also pass. In a separate ordinary UI run, the
read-error component case passes and the write-error case stops at its capture's
orientation guard. Its short test host is corrected to fill the available
height; compilation passes and executed UI verification of that correction is
pending. See `team-draft-error-capture-2026-10-21/README.md`. These are not two
accepted storage-error UI passes. This local draft result
does not close physical-device restart/tracking, push delivery, unread/read state,
other-platform, production or release-audit requirements.
