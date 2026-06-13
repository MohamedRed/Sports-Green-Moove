# API Contracts

All client writes that change money, booking status, ride lifecycle, CO2, or safety state go through Cloud Functions.

## Callable Functions

| Function | Caller | Result |
| --- | --- | --- |
| `setUserRoles` | admin | Updates Firebase Auth `roleKeys` and `users/{uid}.roles` together. |
| `listTrips` | signed-in users | Client-ready published trip summaries for home/trips screens. |
| `suggestPlaces` | signed-in users | Belgian Google Places autocomplete suggestions for search origin/destination. |
| `resolvePlace` | signed-in users | Google Place Details location and formatted address for a selected suggestion. |
| `searchTrips` | signed-in users | Ranked explainable matches. |
| `createTrip` | verified driver | Published ride offer with resolved origin/destination coordinates. |
| `requestBooking` | parent | Pending booking request. Optional `childId` must belong to the caller through `children/{childId}.guardianUserIds`. |
| `listDriverBookingRequests` | driver | Requested/approved booking queue for driver approval screens. |
| `approveBooking` | driver | Approved booking and notification. |
| `cancelBooking` | parent/driver/admin | Cancelled booking and notification. |
| `startRide` | driver | Active ride session with approved booking ids attached as passengers. |
| `getActiveRide` | ride participants | Current active ride snapshot with live labels/passenger statuses, or `null`. |
| `endRide` | driver/admin | Completed ride session, attached bookings, and CO2/reward summary. |
| `markPickup` | driver | Child pickup status and parent notification. |
| `markDropoff` | driver | Child dropoff status and parent notification. |
| `writeLocationBatch` | driver/child | Native fallback location batch bound to the authenticated user. |
| `getInbox` | signed-in users | Notifications, latest chat previews, and pending post-ride review prompts for the Messages screen. |
| `sendChatMessage` | participants | Message and push fanout. |
| `submitRating` | ride participant | Immutable rating. |
| `createReport` | signed-in users | Safety/support report. |
| `reviewReport` | admin | Status, review note, and audit event for a support report. |
| `createStripeAccount` | driver | Connected account record. |
| `createStripeAccountLink` | driver | Stripe onboarding link. |
| `createRidePaymentIntent` | booking parent | Server-priced PaymentSheet config for an approved booking. |
| `issueRewardPayout` | admin | Payout request and ledger entry. |

## Webhooks

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
