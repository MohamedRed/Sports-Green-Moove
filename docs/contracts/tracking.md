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

## Native Update Cadence

- Vehicle: roughly 10-30 seconds during active ride.
- Child device: roughly 30-60 seconds during active ride.
- Upload batches should preserve original `capturedAt`.
- Native clients omit `userId`; `writeLocationBatch` binds every update to the authenticated Firebase user and forces `source = nativeFallback`.
- UI treats live location as stale after 90 seconds unless `appConfig` overrides it.

## Native Fallback Batch

`writeLocationBatch` accepts up to 100 native fallback updates. Each update includes:

- `rideSessionId`
- `role`: `driver` or `child`
- `lat`
- `lng`
- `accuracyM`
- optional `speedMps`, `headingDeg`, `batteryPct`
- `capturedAt`

iOS uses Core Location to write the first fallback batch immediately after ride start when Radar is not configured. Android writes the first fused-location batch and starts a foreground location service for continued fallback uploads. Continuous Radar-delay monitoring still belongs in the Radar SDK integration slice.
