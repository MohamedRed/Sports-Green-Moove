# Team Conversation Service Trial

21 October 2026. Eighteen real isolated callable scenarios passed against the
local demo backend. `run.json` is the original successful trial output;
`services.json` projects its unchanged scenario list for the private portal.
Source snapshots are retained by the original receipt's SHA-256 values.

The owner confirmed adults/verified parents only and history after arrival.
See `docs/contracts/team-conversations.md` for the implemented server contract.

## Executed Checks

- Anonymous callers, unapproved club members and a club manager without team
  approval cannot read. Legacy teamIds membership arrays grant no access.
- Manager-approved adult enrollment allows sending; the verified parent of an
  approved child joins without access to the earlier message.
- Newly sent messages are visible to that parent. Concurrent retries write one
  message, while the same request identity with a different body is rejected.
- Direct Firestore document reads and writes are rejected for the actual parent
  authentication token, preventing bypass of the callable history filter.
- Two equal-timestamp pages contain 57 distinct post-admission messages, without
  duplicates or the pre-admission message. Fifty-five pagination-only records
  are deliberate fixture inserts, not claims of 55 UI sends.
- Guardian revocation blocks reads, older pages, sends and replayed sends. A
  renewed verification starts fresh history and rejects the earlier cursor.
- Rejoining the child's club resets that parent's history boundary.
- Child profile roles, child tokens with mixed adult roles, and child-login
  associations are denied even when an adult token or profile remains present.
- A second parent has independent verification and its own history boundary;
  access does not require being the original enrollment requester.
- The manager's team revocation removes both adult and parent access. An adult
  reapproval does not recover previous messages.
- A team above the supported enrollment bound rejects reads and sends without
  silently excluding participants. Removing the fixture overflow restores access.
- Recreating a child does not inherit its former approval/parent authority.
  Recreating a team does not inherit its former enrollments or history.

Club/team enrollment and parent verification decisions use authenticated local
callables. The fresh-role, pagination, size-limit and child-login-association
negative scenarios use explicitly controlled disposable fixture mutations.
The child-login association check intentionally rejects even incomplete link
metadata rather than interpreting it as an adult account.

## Disposal And Limits

After fixture setup, every pre-existing protected document is deeply compared
with its baseline and the original three accounts' claims are unchanged. The
admin client closes; the entire temporary environment is destroyed and all four
local service ports are verified closed. The receipt proves those facts.

The initial attempt rejected a seeded membership timestamp that preceded actual
club creation; the fixture now records a post-creation membership update. A
later attempt reached its end but rejected JSON field ordering as a difference;
deep comparison now verifies values without depending on object key order.
These failed attempts were not promoted to successful evidence.

No real accounts, production writes, paid provider requests, phone screens or
notifications are proven. Android/iOS entry, message presentation, unread/read
state, notification delivery and actual phone exchanges remain unfinished. No
screen capture is fabricated for this server-only result. Full release readiness
and the existing emergency/physical-tracking gaps remain open.
