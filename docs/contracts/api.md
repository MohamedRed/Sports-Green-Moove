# API Contracts

All client writes that change money, booking status, ride lifecycle, CO2, or safety state go through Cloud Functions.

## Callable Functions

| Function | Caller | Result |
| --- | --- | --- |
| `listTrips` | signed-in users | Client-ready published trip summaries for home/trips screens. |
| `searchTrips` | signed-in users | Ranked explainable matches. |
| `createTrip` | driver | Published ride offer. |
| `requestBooking` | parent | Pending booking request. |
| `approveBooking` | driver | Approved booking and notification. |
| `cancelBooking` | parent/driver/admin | Cancelled booking and notification. |
| `startRide` | driver | Active ride session. |
| `getActiveRide` | driver | Current active ride snapshot, or `null`. |
| `endRide` | driver/admin | Completed ride session, CO2/reward jobs queued. |
| `markPickup` | driver | Child pickup status and parent notification. |
| `markDropoff` | driver | Child dropoff status and parent notification. |
| `writeLocationBatch` | driver/child | Native fallback location batch. |
| `sendChatMessage` | participants | Message and push fanout. |
| `submitRating` | ride participant | Immutable rating. |
| `createReport` | signed-in users | Safety/support report. |
| `createStripeAccount` | driver | Connected account record. |
| `createStripeAccountLink` | driver | Stripe onboarding link. |
| `createRidePaymentIntent` | parent | PaymentSheet client secret. |
| `issueRewardPayout` | admin | Payout request and ledger entry. |

## Webhooks

| Webhook | Path | Behavior |
| --- | --- | --- |
| Radar | `/radarWebhook` | Validates signature, updates live/audit state, emits arrival/pickup/dropoff notifications. |
| Stripe | `/stripeWebhook` | Validates signature, reconciles PaymentIntent, transfer, account, and payout events. |
