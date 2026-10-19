# Actual Vehicle Map Trial: Route Accessibility Failure

- Source: `17960e930e5a3cf89270fe52bddd1a6fdefc6171`.
- Native CI manual run: `39319579304`, failed on 2026-10-19.
- Original artifact metadata is retained in `artifacts.json`.
- All 17 original artifact files, the failed job log, run metadata, and the
  exact pre-fix map source are retained and hashed in `artifact-sha256.json`.

## Actual Outcome

The isolated application compiled with the secured Android map credential.
The explicit temporary installation policy activated, both APKs installed through
the guarded window, and one real native instrumentation case executed. It failed
at the first point with `A single actual route anchor is required`.

The reviewed original failure screenshot shows a loaded street map, two red route
pins and one green vehicle pin in the active ride. It is a failure capture, not a
passed movement assertion. The second position, final sign-out, native database
termination and post-flow fixture isolation were not reached. No positive device
or host map report exists. No movement, ETA, child coordinates, provider GPS,
physical-device, store or safety-audit requirement is accepted by this record.

## Root Cause And Correction

The retained application source supplies route-marker titles but omits their
accessibility content descriptions. The vehicle marker already supplies its own
description. In the pinned Maps Compose 8.3.0 source, `Marker` defaults
`contentDescription` to an empty string independently of `title`:
https://github.com/googlemaps/android-maps-compose/blob/v8.3.0/maps-compose/src/main/java/com/google/maps/android/compose/Marker.kt

The correction supplies explicit French accessible names for both real route
markers and selects those exact names in the native evidence collector. The
one-marker, visible-bounds, nonblank-map, rendered-pin, stable-camera and actual
movement requirements are unchanged. A failed future capture records only counts
for those two known accessibility labels, not an arbitrary UI hierarchy.

## Cleanup Scope

The actual restore receipt reports `restored: true`, `verified: true`, unchanged
map services, location enabled, no active installation, removal of the temporary
administration component and restoration of the original installation policy.
The failed job log records local service shutdown. This attempt does not contain
a separate successful four-endpoint/runtime-disposal receipt; do not infer one.
Original files have not been edited or relabelled as passing evidence.
