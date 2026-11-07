# Pending Review Pagination

The old inbox inspected only the first 30 participant rides and first 30 driver
rides. The retained 31-ride reproduction proves that an unrated completed ride
could disappear for both accounts. Increasing that window is not the solution.

`getPendingReviews` accepts exactly `{cursor?: string}` from an authenticated
account and returns `{userId, items, nextCursor}`. `getInbox` includes the same
first page as `reviews`, `reviewsUserId` and `reviewsNextCursor`, alongside its
unchanged bounded notification/chat previews. Its legacy no-argument request
remains supported. Older clients cannot traverse additional pages: coordinated
client rollout is required, not a claim that old binaries gained pagination.

## Traversal And Privacy

One query selects completed rides where the caller is the driver or appears in
`participantUserIds`. The disjunction deduplicates rides matching both roles.
Document ID ascending order gives a deterministic cursor without dropping older
rides whose completion/start timestamps are absent. No local lexical sorting or
offset is used. A cursor is canonical base64url, validated with the repository's
existing scoped document-ID codec and bound to `pending-reviews:<authenticated
UID>`. It is a position, not an authorization credential; every query applies
the current caller's filters. Unknown fields, malformed and foreign-list or
foreign-account cursors are rejected. The server never accepts a target UID.

Each request fetches at most 101 rides, evaluates at most 100 and returns at most
20 pending prompts. Existing immutable rating IDs are read directly in one
bounded `getAll`; only this author's rating for that exact ride/target suppresses
the prompt. When the pending page fills, continuation is after its last scanned
ride, not after fetched-but-unreturned reviews. A fully rated scan can return
zero prompts with a non-null cursor. Only a null cursor means traversal ended.
Deleting the cursor's anchor does not invalidate `startAfter(documentId)`.
The original target-selection and rating-submission contracts are unchanged.

Pagination is a live traversal, not a historical snapshot. Newly completed rides
before the current cursor appear after refreshing from the beginning. Submitting
a visible review removes that review without resetting a loaded second page.
Already submitted IDs remain suppressed for that account's current screen.

## Native Clients

Android and iOS expose explicit continuation. Empty unfinished scans say
`Continuer la recherche`, not `Aucun avis en attente`. A failed page retains
current rows and its cursor for retry. Responses have strict account identity,
row identity, unique IDs, bounded page size and nullable cursor parsing. A
non-advancing response fails instead of looping. Refresh/disposal invalidate
late replies, and account changes cannot inherit another account's page.
The tab badge counts currently loaded pending reviews, not an invented total.

## Rollout And Evidence Limits

The two `rideSessions(status, driverUserId)` and
`rideSessions(status, participantUserIds CONTAINS)` indexes are declared in the
existing `firestore.indexes.json`. Deploy indexes and await readiness, then the
callables, then matching clients. No production deployment or Terraform change
is made here; this project already owns these indexes through Firebase config.
Local emulators do not prove production composite-index readiness.

Service evidence covers the original 31st-ride gap, 320 completed rides, 240
authored ratings, two empty continuation pages, all 320 parent requests, 80
driver requests, scope checks, repeated/deleted cursor anchors and later-page
submission. The physical Android replay independently verifies two real phone
submissions and one continuation over a 31-ride isolated dataset. iOS model/wire
checks are not an iOS UI, SDK integration or physical-phone result. Instrumented
component-test builds alone are not execution proof. The later local context
checks are in `review-trip-context.md`; contextual review replay on a phone
and historical data verification remain open before full user-flow sign-off.
