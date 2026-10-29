# API Contracts

All client writes that change money, booking status, ride lifecycle, CO2, or safety state go through Cloud Functions.

## Callable Functions

| Function | Caller | Result |
| --- | --- | --- |
| `setUserRoles` | admin | Updates Firebase Auth `roleKeys` and `users/{uid}.roles` together. |
| `requestClubMembership` | signed-in users | Deterministic ordinary-member request. A rejected request can be resubmitted; old current-review fields are cleared without deleting audit history. |
| `listMembershipReviewClubs` | admin/clubManager | Pages of 20 clubs. Managers see only clubs with their active `clubManager` membership; cursor is actor/list/role bound. |
| `listClubMemberships` | admin/scoped clubManager | Pages of 20 club memberships, document revision and allowed decisions; no client-side privilege inference. |
| `reviewClubMembership` | admin/scoped clubManager | Exact `membershipId`, `decision` (`approve`/`reject`) and `expectedVersion` required. Atomically changes an ordinary pending request, increments the existing club counter only on approval, creates an immutable review and a recipient notification. Stale/repeated decisions fail; no global roles are granted. |
| `transitionGuardianVerification` | owning parent / scoped clubManager | Versioned request/withdraw or verify/refuse/revoke with a stable operation UUID. Managers cannot verify themselves; admin alone cannot decide. Private verification and audit only, not team enrollment or chat access. See [parent-child verification](guardian-verification.md). |
| `listTrips` | signed-in users | Client-ready published trip summaries for home/trips screens. |
| `suggestPlaces` | signed-in users | Belgian Google Places autocomplete suggestions for search origin/destination. |
| `resolvePlace` | signed-in users | Google Place Details location and formatted address for a selected suggestion. |
| `searchTrips` | signed-in users | Ranked explainable matches. |
| `createTrip` | verified driver | Published ride offer with resolved origin/destination coordinates. |
| `requestBooking` | parent | Pending booking request. Optional `childId` must belong to the caller through `children/{childId}.guardianUserIds`. |
| `listDriverBookingRequests` | driver | Requested/approved booking queue for driver approval screens. |
| `approveBooking` | driver | Approved booking and notification. |
| `declineBooking` | owning driver | Decline a requested booking on an open, not-started trip without changing seats; notify its guardian. Repeated/late decisions are rejected transactionally. |
| `listReservations` | parent/driver | Role-scoped pages of 20 bookings, newest first, with server-computed allowed actions and refund-pending state. Owner/list-bound cursor; history is retained. |
| `cancelBooking` | parent/driver/admin | Cancelled booking and notification. |
| `startRide` | driver | Active ride session with approved booking ids attached as passengers. |
| `getActiveRide` | ride participants | Current active ride snapshot with live labels/passenger statuses, or `null`. |
| `endRide` | driver/admin | Completed ride session, attached bookings, and CO2/reward summary. |
| `markPickup` | driver | Child pickup status and parent notification. |
| `markDropoff` | driver | Child dropoff status and parent notification. |
| `writeLocationBatch` | driver/child | Native fallback location batch bound to the authenticated user. |
| `getInbox` | signed-in users | Notifications, bounded legacy previews and the first pending-review page, with account identity and continuation. Android no longer discovers conversations from these previews. |
| `getPendingReviews` | signed-in users | Account-scoped completed-ride review pages with a cursor, including empty continuation pages. See pending-review pagination contract. |
| `listChatConversations` | signed-in participants | Paginated private conversation summaries with full unread counts; optional user/list-bound immutable cursor. |
| `listChatBookingOptions` | booking parent/driver | Paginated reservation context for starting a first message; does not create messages. |
| `sendChatMessage` | participants | Atomic message, recipient notification records and private summary updates; keyed retries are idempotent. No push-delivery proof implied. |
| `getChatConversation` | participants | Reauthorizes an exact booking/ride conversation before listening. |
| `markChatMessagesRead` | participants | Atomically acknowledges up to 50 exact addressed messages/notifications and decrements only newly read incoming counts. |
| `submitRating` | ride participant | Immutable rating. |
| `getReceivedRatingSummary` | authenticated user | Own received-review count and mean only; no raw review details. |
| `createReport` | signed-in users | Safety/support report. |
| `reviewReport` | admin | Status, review note, and audit event for a support report. |
| `createStripeAccount` | driver | Connected account record. |
| `createStripeAccountLink` | driver | Stripe onboarding link. |
| `createRidePaymentIntent` | booking parent | Server-priced PaymentSheet config for an approved booking. |
| `issueRewardPayout` | admin | Payout request and ledger entry. |

## Team Enrollment (Source, Not Deployed)

| Callable | Access | Behavior |
| --- | --- | --- |
| `getTeamEnrollmentView` | eligible adult, verified parent or owned history | Auth-bound self/child view; no writes. Exact team and enrollment identities, revision and allowed actions. |
| `requestTeamEnrollment` | eligible adult or currently verified parent | Requests, never approves. Requires viewed `expectedTeamInstanceId`, `expectedEnrollmentId`, `expectedRevision` and UUID `requestId`. |
| `transitionTeamEnrollment` | scoped manager; requesting account for withdrawal | Versioned approve/refuse/revoke/withdraw by exact enrollment ID. Current eligibility required for approval; payload-bound idempotency never restores stale state. |
| `listTeamEnrollments` | current stored-club manager | At most 20 scanned rows per page, with account/team-identity-bound cursor; nullable authorized labels and allowed actions. |
| `listTeamEnrollmentOptions` | eligible adult; current verified parent for child choices | Strict `kind`: `clubs`, `teams` plus `clubId`, or `children` plus `teamId`; optional context/account-bound cursor. At most 20 scanned rows plus lookahead; no writes. An empty filtered page may still have a next cursor. |

See [team conversations](team-conversations.md) for lifecycle, identity reuse and
withdrawal policy. These endpoints do not enable team messages or change roles.

Membership, guardian and team directory cursors share a version-one opaque
base64url contract with a 16,384-character limit. The embedded Firestore document
ID is distinct from an individual user/club/team ID and can include the canonical
membership prefix. It must be valid UTF-8 and at most 1,500 bytes. The actor/list
scope remains exact; a wider input bound is not broader read authority. Clients
retain the entire token or reject it, never truncate it or convert an invalid
token to an empty page. The server and current browser/Android sources must be
released together. Chat/reservation/trip-history cursor formats are unchanged.

## Provider Webhooks

| Webhook | Path | Behavior |
| --- | --- | --- |
| Radar | `/radarWebhook` | Validates signature, updates live/audit state, emits arrival/pickup/dropoff notifications. |
| Stripe | `/stripeWebhook` | Validates signature, reconciles PaymentIntent booking status, account updates, and reward ledger entries. |

## Publish Trip Requirements

`createTrip` rejects incomplete client payloads. Native clients must send resolved
origin and destination coordinates, club/team/category, departure time, seats,
baggage, return-trip flag, tracking support flags, price, and CO2 estimate.
The server reads `users/{uid}.driverVerified` and `driverRating`; clients cannot
self-declare verification or trust score.
