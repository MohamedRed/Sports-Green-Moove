# Vehicle Map Trial: Marker Observation Still Unproven

- Source: `ac35db93e43523e565654b318ba164afd68e7ad4`.
- Actual manual Native CI run: `39321354471`, failed on 2026-10-19.
- The 17 original artifact files, original failed log and authoritative run/artifact
  metadata are retained without edits and bound by `artifact-sha256.json`.

One native case executed and timed out at the first point after 60 seconds. This
was the combined map-loaded/vehicle-marker condition, before the route-anchor
bounds or second-point movement assertion. The failure report records zero
matches for both newly named route anchors. It did not record which part of the
combined condition failed, the vehicle match count or the map accessibility tree.

The reviewed failure PNG shows loaded streets, two red route pins and one green
vehicle pin. It does not prove that accessibility observation was fresh, that
the map-loaded state was true or that the marker moved. The missing observation
cannot truthfully be diagnosed as a provider outage, a fixed application defect
or a proven accessibility-cache fault from these files alone.

The next source adds failure-only diagnostics: actual map state counts, exact
known marker counts, and bounded accessibility descriptions/bounds from within
the application's map region. It compares the cached view with one explicitly
cleared cache only after the original trial has already failed. It never repeats
or weakens the original assertions and cannot turn a failed case into a pass.
No arbitrary UI text, credentials, off-map content or other application's window
is collected. This is a diagnostic change, not an accepted movement fix.

The original restore receipt reports successful verification, unchanged map
services, location enabled, no active installation and removal of temporary
administration with the original policy restored. No positive map device/host
report or separate successful four-endpoint disposal receipt exists. Physical
tracking, child positions, ETA, store and safety-audit acceptance remain open.
