# Tracking And Safety

## Policy

- Tracking is active only between `startRide` and `endRide`.
- Vehicle tracking is required for active rides.
- Child-device tracking is optional per child but supported in v1.
- If no child device is available, the app uses vehicle tracking plus driver pickup/dropoff confirmations.
- Parents always see last update time and stale-state warnings.

## Location Sources

| Source | Use |
| --- | --- |
| `radar` | Preferred source for trip tracking, geofence, and arrival events. |
| `nativeFallback` | Direct app-to-Firebase batch writes when Radar is delayed or unavailable. |
| `manual` | Driver pickup/dropoff confirmations and support/admin corrections. |

## Radar Webhook

Radar webhooks must include `X-Radar-Signing-Id` and `X-Radar-Signature`.
The backend verifies `X-Radar-Signature` as HMAC-SHA1 of the signing id using
`RADAR_WEBHOOK_SECRET`.

The webhook accepts both single-event and batched payloads:

- `{ "event": { ... }, "user": { ... } }`
- `{ "events": [{ ... }], "user": { ... } }`

For trip tracking, `trip.externalId` is the `rideSessionId`. Radar user metadata
or event/trip metadata may set `role = "child"`; otherwise updates are treated
as vehicle/driver tracking.

Every Radar event with a ride session is written to
`rideSessions/{rideSessionId}/auditEvents/{eventId}` and summarized onto the
ride session document as `lastRadarEvent`, `lastRadarAction`, `radarStatus`, and
`radarEventCount`. Live trip RTDB meta is updated at
`liveTrips/{rideSessionId}/meta/radar`.

Radar trip destination events emit parent/driver notifications for approaching
and arrival. Geofence events can emit pickup/dropoff notifications by setting
`sgmAction = "pickup"` or `sgmAction = "dropoff"` in Radar event or trip
metadata.

## Native Update Cadence

- Vehicle: roughly 10-30 seconds during active ride.
- Child device: roughly 30-60 seconds during active ride.
- Upload batches should preserve original `capturedAt`.
- Native clients omit `userId`; `writeLocationBatch` binds every update to the authenticated Firebase user and forces `source = nativeFallback`.
- UI treats live location as stale after 90 seconds unless `appConfig` overrides it.

## Native Fallback Batch

`writeLocationBatch` accepts up to 100 native fallback updates as either:

- `updates`: an array of update objects.
- `updatesJson`: a JSON string containing the same update-object array. iOS uses this shape because Firebase Functions' Swift 6 callable API treats arbitrary `Any` payload dictionaries as non-Sendable.

Each update includes:

- `rideSessionId`
- `role`: `driver` or `child`
- `lat`
- `lng`
- `accuracyM`
- optional `speedMps`, `headingDeg`, `batteryPct`
- `capturedAt`

## Native Radar SDK

Android uses `io.radar:sdk:3.34.0` when `SGM_RADAR_PUBLISHABLE_KEY` is present at build time. Driver ride start initializes Radar from the generated Android string resource, sets the Firebase UID as the Radar user id when available, writes metadata `{ rideSessionId, role, source: "nativeSdk" }`, and calls `startTrip` with `externalId = rideSessionId` and `RadarTrackingOptions.CONTINUOUS`.

iOS uses Core Location to write the first fallback batch immediately after ride start when Radar is not configured. Android writes the first fused-location batch and starts a foreground location service for continued fallback uploads. Continuous Radar-delay monitoring still belongs in the Radar SDK integration slice.
