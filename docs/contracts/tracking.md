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
- UI treats live location as stale after 90 seconds unless `appConfig` overrides it.

