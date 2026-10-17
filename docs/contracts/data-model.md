# Data Model

## Durable Firestore Collections

| Collection | Purpose |
| --- | --- |
| `users` | Profile, roles, verification, notification preferences, Stripe state summary. |
| `children` | Child profile, guardian links, tracking consent, child-device identity, team memberships. |
| `clubs` | Club identity, region, manager users, public status. |
| `teams` | Team/category such as U8 Nationaux, linked to a club. |
| `memberships` | User/child membership in clubs and teams. |
| `trips` | Published driver ride offers. |
| `bookings` | Parent passenger requests and driver approvals. |
| `rideSessions` | Active/completed ride lifecycle and safety audit state. |
| `messages` | Chat messages linked to trip/booking/ride session. |
| `chatInboxes` | Server-owned per-user conversation index with full unread counts, activity position and revision; only its owner may read. |
| `notifications` | In-app notification feed and push metadata. |
| `ratings` | Post-ride ratings and comments. |
| `co2Ledger` | Immutable CO2 accounting entries written when rides complete. |
| `rewardLedger` | Immutable reward, bonus, payment, and payout ledger entries. |
| `stripeAccounts` | Connected account state and onboarding status. |
| `reports` | Safety/support reports, admin review status, latest review note, and review audit events. |
| `appConfig` | Runtime config such as CO2 factors, thresholds, and feature flags. |

## Realtime Database

`liveTrips/{rideSessionId}` stores current active-ride snapshots only:

```json
{
  "meta": {
    "tripId": "trip-id",
    "driverUserId": "driver-user-id",
    "participantUserIds": {
      "parent-user-id": true
    },
    "childUserIds": {
      "child-user-id": true
    },
    "status": "active",
    "startedAt": 1731001100000
  },
  "vehicle": {
    "userId": "driver-user-id",
    "lat": 50.669,
    "lng": 4.612,
    "accuracyM": 8,
    "speedMps": 11.4,
    "headingDeg": 270,
    "batteryPct": 0.72,
    "capturedAt": 1731001200000,
    "uploadedAt": 1731001202000,
    "source": "radar"
  },
  "children": {
    "child-user-id": {
      "userId": "child-user-id",
      "lat": 50.671,
      "lng": 4.611,
      "accuracyM": 14,
      "batteryPct": 0.64,
      "capturedAt": 1731001200000,
      "uploadedAt": 1731001203000,
      "source": "nativeFallback"
    }
  }
}
```

Firestore and Realtime Database rules allow ride/live-trip reads only for the driver, listed parent participants, listed child-device users, and admins.
Live state is mirrored into Firestore audit summaries by Cloud Functions. The UI must show stale-state warnings when `uploadedAt` is older than the configured threshold.

Native clients list `children` with `guardianUserIds array-contains auth.uid` and pass the selected `childId` to `searchTrips` and `requestBooking`.
`requestBooking` re-reads the child profile server-side and rejects ids that do not belong to the authenticated parent.

Ordinary direct trip updates are limited to the owner's legacy cosmetic `title`
field. Other trip details, including price, route, timing, tracking and future edit
metadata, require server-owned handling. A field allowlist denies unknown fields,
removals and mixed title/operational mutations as well. Administrator policy is
unchanged. Full trip editing and its post-reservation parent-confirmation policy
remain open; see [trip editing](trip-editing.md).

Native Groups screens list public `clubs` and join them with the signed-in
user's `memberships` to separate "Mes clubs" from discoverable clubs. They must
not ship static club lists as product data.
When a signed-in user taps "Rejoindre", the app calls `requestClubMembership`.
The backend writes `memberships/{userId}_{clubId}` with `status = "requested"`
and `active = false`; club managers/admins can later review the membership in
the admin console. Requested memberships render as pending requests, not active
member clubs.

The management site admits administrators and club managers into separate
workspaces. Manager authority requires the global `clubManager` claim plus an
exact, active, manager-role membership in the selected club; a requested or
ordinary membership never grants management access. A false `active` flag revokes
that authority even while a role token remains valid. Non-admin direct membership
writes are denied; managers review through `reviewClubMembership`.

Review uses the Firestore document update revision, not a client timestamp, to
reject stale dialogs and old decisions after a re-request. Accepted requests
become `status = "active", active = true`; refused requests become
`status = "rejected", active = false`. The role remains `member`. Each decision
atomically records `reviewedByUserId`, `reviewedAt`, a `membershipReviews` event
and a `membershipReviewed` notification. The existing nonnegative integral club
`memberCount` increments once on approval; missing/invalid counters require repair,
not an invented starting value. Notification records do not prove push delivery.

Android membership display requires explicit active status (or the already
supported legacy `active = true` record without status), never just a role label.
An explicit refusal/inactive status takes precedence over a conflicting flag.
Membership lists retain team labels and resolve child principals from `children`,
not from unrelated user profiles. These changes require coordinated Functions,
rules, management-site and native-client deployment; local checks do not deploy them.

Android's Groups route reloads on entry/resume and offers an explicit refresh.
Membership and club reads require the server under one unchanged authenticated
identity. Loading/errors do not render a confirmed empty list or stale join
controls. Requests are serialized; an uncertain write requires an explicit read,
not an automatic retry. An acknowledged write remains acknowledged if its later
read fails. Leaving the route/account invalidates pending callbacks, and a slow
whole-app snapshot cannot overwrite a newer Groups result. Club summaries are
shared back to the profile only after the scoped read succeeds. Discovery and
membership queries still have the existing 50-record bounds; this is not full
directory pagination or a group-chat implementation.

Android conversation discovery reads through `listChatConversations`, backed by private `chatInboxes` entries rather than the latest 50 messages. The reservation picker uses `listChatBookingOptions`; an empty conversation is not persisted until a real send. `getInbox` remains compatible for notifications, bounded legacy previews and pending `ratings` prompts derived from completed ride sessions. iOS still uses that legacy contract. See [conversation rollout](../release/chat-inbox-rollout.md) for summary fields, historical preparation and coordinated deployment requirements.
