# Actual Vehicle Marker Movement: Local App Trial Passed

- Manual Native CI run `39325056323`, successful on 2026-10-19.
- Source `0fa64e812969c5690db62a7d4f39f51e3cb4deb6`.
- One actual native case: `OK (1 test)` in 39.356 seconds.
- The 12 original artifact files and authoritative run/artifact metadata remain
  unchanged and are bound by `artifact-sha256.json`.
- All 13 declared source bindings were recovered from that exact Git commit,
  verified against the original report and retained in `source-archive/`.

## Verified Scope

The parent opens the active ride in the actual isolated app. A separate
authenticated driver sends two fictional coordinates. The parent remains signed
in as the parent and reads back each matching server point. The loaded native
street map shows the actual green vehicle marker at two distinct locations.

Both reviewed original 1080x2400 captures show the whole map and both red route
anchors. The vehicle marker moves 316.886 pixels. Map bounds and both route-anchor
bounds are exactly unchanged, so scrolling or moving the camera cannot stand in
for the vehicle's movement. Both captures have nonblank map raster samples and
more than 5,000 green pixels within the actual accessible vehicle-marker bounds.

The observer refreshes its accessibility snapshot before normal marker reads.
The preceding failed attempts remain separately retained as failures. Their
assertions, visible-bounds, loaded-map and movement requirements were not relaxed.

The final point matches the retained live-trip record; the approved booking and
active ride remain correct, driver claims are unchanged, baseline records and
other live rides are preserved. The parent signs out and the native database
client terminates. Local app packages are removed, the owned temporary runtime
is destroyed and all four emulator ports are confirmed closed. Device restoration
is independently verified: map services unchanged, location enabled, no active
installation, temporary administrator/helper removed and original policy restored.

## Still Open

These are synthetic positions sent through the isolated backend, not positions
from a moving physical phone or a live tracking provider. This does not validate
GPS quality, foreground/background/locked-screen tracking, GPS/network loss,
restart, battery saver, webhook delays, child positions, ETA, safety-audit or store
acceptance. It is an independent portrait map-display trial, not a new complete
native regression run. No production accounts, rides or payments were changed.

Earlier coordinate-only checks and parent status/rotation captures keep their
original scopes in `vehicle-map-services-2026-10-19` and
`ride-observation-native-2026-10-19`; they are not retroactively relabelled as map
rendering proof. Both new captures may be published with their actual local scope.
