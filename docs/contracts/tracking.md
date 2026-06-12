# Tracking And Safety

## Policy

- Tracking is active only between `startRide` and `endRide`.
- Vehicle tracking is required for active rides.
- Child-device tracking is optional per child but supported in v1.
- If no child device is available, the app uses vehicle tracking plus driver pickup/dropoff confirmations.
- Parents always see last update time and stale-state warnings.
- Live RTDB reads are limited to the ride driver, participant parents, listed child-device users, and admins.

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
- `writeLocationBatch` accepts updates only for active ride sessions where the caller is the ride driver for vehicle updates or a listed child-device user for child updates.
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

Native apps call `startRide` with the approved booking ids selected for the trip. The backend stores those bookings as ride passengers, and the driver UI renders pickup/dropoff controls from the returned `passengers` snapshot. `markPickup` and `markDropoff` update both the ride session passenger state and the booking record before notifying the parent.

Android uses `io.radar:sdk:3.34.0` when `SGM_RADAR_PUBLISHABLE_KEY` is present at build time. Driver ride start initializes Radar from the generated Android string resource, sets the Firebase UID as the Radar user id when available, writes metadata `{ rideSessionId, role, source: "nativeSdk" }`, and calls `startTrip` with `externalId = rideSessionId` and `RadarTrackingOptions.CONTINUOUS`.

iOS uses `RadarSDK` `3.34.0` when `SGM_RADAR_PUBLISHABLE_KEY` is present at build time. Driver ride start initializes Radar from `Info.plist`, sets the Firebase UID as the Radar user id when available, writes metadata `{ rideSessionId, role, source: "nativeSdk" }`, and calls `startTrip` with `externalId = rideSessionId` and `RadarTrackingOptions.presetContinuous`.

Native Firebase fallback runs for every active ride, including rides where Radar starts successfully. Android writes the first fused-location batch and starts a foreground location service for continued fallback uploads. iOS writes the first Core Location batch and starts continuous background-capable Core Location uploads. If Radar webhooks are delayed, the app still has live `nativeFallback` points in `liveTrips/{rideSessionId}`.

`getActiveRide` reads `liveTrips/{rideSessionId}` and returns source-aware labels for the native apps. Vehicle location is stale when no vehicle point exists or the latest vehicle point is older than 90 seconds.

Native end-ride actions call `endRide`, stop Firebase native fallback, and complete Radar trip tracking when Radar is configured. `endRide` completes the ride session and any attached bookings, then writes completed metadata to `liveTrips/{rideSessionId}/meta`.
