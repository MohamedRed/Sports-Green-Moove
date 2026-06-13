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
| `notifications` | In-app notification feed and push metadata. |
| `ratings` | Post-ride ratings and comments. |
| `co2Ledger` | Immutable CO2 accounting entries. |
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

The Messages tab reads through `getInbox`, not direct static fixtures. The callable returns the caller's `notifications`, groups recent `messages` by booking or ride-session conversation, and derives pending `ratings` prompts from completed ride sessions where the caller has not yet rated the other participant.
