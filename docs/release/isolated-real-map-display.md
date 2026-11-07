# Isolated Android Map Display

The normal local build intentionally has no live provider resources. The manual,
approved real-map replay explicitly sets `SGM_LOCAL_REAL_MAPS_UI=true` in addition
to `SGM_USE_FIREBASE_EMULATOR=true`. This opt-in requires an Android display key
and fails configuration outside the isolated build or without that key. Key
presence alone never enables local maps. Radar, payments and social-provider
resources remain disabled; authentication, accounts and bookings stay local.

The display key is passed only to the APK build. The server map credential is
removed from the build environment, stays in the parent broker during the replay,
and permits at most five approved Places/Routes requests across all workers.
The Android map SDK separately loads real map tiles; these requests are not part
of the five server request cap. Both are authorized only for this manual replay.
Routine CI and the ordinary offline local replay never opt in.

The replay now requires the real SDK `onMapLoaded` callback, the complete proposed
map in the visible native screen, and a nonblank central raster. It saves the
unaltered full native display, a precisely bounded map crop, and its pixel-check
receipt. The crop excludes nothing inside its recorded bounds; the raster check
samples only its central 60% to avoid treating attribution or controls as tiles.
Pixel checks are a blank-image guard, not geographic verification. Review the
original display and crop before recording map-rendering evidence as verified.

Loaded tiles do not prove that both pins fit: the first passed display run
retains a visibly clipped departure marker. The current implementation fits SDK
bounds to measured pixel dimensions with 48 dp marker padding, includes endpoints
and any decoded route points, and validates the actual projected anchors before
reporting ready. It owns a fresh one-shot load callback after fitting and clears
it when the effect ends. Route/size changes refit; ordinary recomposition or a
user pan does not. `mapFramingVerified` additionally requires the new native
`anchorsFramed` proof. Historical loaded-map receipts without it stay scoped to
tile display. See [SDK camera bounds](https://developers.google.com/maps/documentation/android-sdk/views#updating_camera_to_fit_bounds)
and the pinned [map effect API](https://googlemaps.github.io/android-maps-compose/maps-compose/com.google.maps.android.compose/-map-effect.html).

Configuration and compile tests are not proof that the key permits the isolated
package/debug certificate or that tiles render. A rejected key or load timeout
must fail the replay. Do not widen key restrictions, substitute another key,
draw a fake map, increase deadlines or retry a failed evidence copy to mark this
flow passed. Preserve the original failure and diagnose its actual cause.

Reference: [SDK map-load callback](https://googlemaps.github.io/android-maps-compose/maps-compose/com.google.maps.android.compose/-google-map.html).
The prior successful route application and its explicitly unavailable map remain
in `evidence/real-maps-native-2026-10-18/`; this configuration change does not
retroactively verify those screenshots or physical-device behavior.
