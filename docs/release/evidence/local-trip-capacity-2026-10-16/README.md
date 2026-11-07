# Trip Capacity Ownership

## Reproduced Defect

With the rules at `dfb6aa6f8fb9ed1fb8c968dce1d3292ec14c1a23`, an ordinary
driver could directly write seatsAvailable and seatsTotal on their published
trip. This bypassed the booking transaction's capacity accounting.

`services-before.json` records isolated run `120b63a303021ee4d38f33e9d769d6f2`
at 2026-10-16T09:14:09.518Z. After creating a four-seat trip and approving a
two-seat booking through the real local callables, the signed-in driver's direct
Firestore request to reset availability to four returned HTTP 200 rather than
PERMISSION_DENIED. The prior 16 service groups passed; the new seventeenth group
failed. This is failed evidence, not an accepted flow result.

`rules-before.xml` separately records ten rule cases with nine failures. Direct
owner updates, invalid types/counts, compound title/capacity changes and replacement
documents removing either capacity field were accepted. The positive title-edit
and outsider-denial controls passed.

## Root Fix And Verification

Both capacity fields now belong to the existing server-owned protected-field
set. Ordinary driver writes cannot change or remove them, including as part of
a larger document update. Existing trusted administrator access is unchanged;
this does not claim protection against privileged administration. The working
driver title edit remains allowed. No client-side restriction or fallback is used.

`services-after.json` records run `7aeb2b90da53b0cc1032b6ac7fcb0ded` at
2026-10-16T09:16:21.777Z: all 17 isolated service groups pass. The new scenario
uses actual locally authenticated users, direct Firestore REST writes and the
booking callables, with independent persisted-document checks:

- Approval consumes two of four seats.
- Seven direct driver mutations are denied, including deletion, type changes
  and an atomic title/capacity update.
- Parent, outside user and unauthenticated capacity mutations are denied.
- A driver title update succeeds without changing either capacity field.
- The approved booking remains intact; parent cancellation restores availability
  from two to four, and repeated cancellation is rejected without over-restoring.

`rules-after.xml` records all 26 cases passing across the four rule suites,
including all ten new capacity cases. Backend CI registers the new rule file;
Web Integration Smoke runs the seventeen-group scenario and evidence guards.

## Scope And History

These are local service and data-access checks, not a new phone-screen recording.
The existing reservation captures still come from
`docs/release/evidence/local-reservations-2026-10-16/`; they are not relabeled as
captures of this new scenario. Trip editing/cancellation UI, live refunds,
physical tracking and provider payments remain unverified or unimplemented.

The rules have not been deployed to production. Existing production capacity data
has not been audited or repaired by this task. No real user records, privileged
roles, paid resources or release-manifest acceptance were changed.
