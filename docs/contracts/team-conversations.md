# Team Conversations

## Agreed Audience

On 2026-10-16 the product owner selected members of one team, not all members
of the club, as the audience for group messages. This is a product decision,
not evidence that the flow is implemented or tested.

Current conversation sources support bookings and ride sessions only. Team
conversation entry, authoritative team membership and its lifecycle, message
authorization, and the corresponding app flow remain to be implemented and
verified together. Club membership alone must not grant team-message access.

## Required Verification

- Two active members assigned to the same team can open the conversation,
  exchange messages and receive the corresponding unread/read state.
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

Tests must use two teams in one isolated club plus an outside account. Retain
denial evidence as well as successful exchanges. Do not reuse a booking exchange
as proof of team access or publish a non-functional team-message button.
