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
conversation entry, authoritative team membership and its lifecycle, message
authorization, and the corresponding app flow remain to be implemented and
verified together. Club membership alone must not grant team-message access.

## Ownership Boundary

Local rules and signed-in transport checks reproduced and fixed a cross-club
team update at `local-team-ownership-2026-10-16`: manager updates now retain the
stored club ID and require authority over that existing club. This does not
implement team conversation access. Direct create/delete and administrator
capabilities keep their prior policy, so identity reuse and the complete
enrollment/guardian lifecycle still need server-owned handling before chat is
wired. See the dated release evidence for the unchanged red/green reports.

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
actively enrolled child; club approval is not permission to invent or edit
guardian relationships. Requests, refusals and removals retain the denial and
revocation requirements above. The lifecycle and chat flow remain unimplemented
and unverified; this product decision does not approve any production records.
