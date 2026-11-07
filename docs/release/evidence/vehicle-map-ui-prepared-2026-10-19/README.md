# Prepared Vehicle-Marker Display Trial

The new targeted trial is compiled and its evidence-validator contracts pass.
This directory is preparation evidence only: no new map-rendering or movement
success has been accepted. The local compile uses an isolated build without a
map credential; actual display execution requires the approved manual job.

The manual `Native CI` input `vehicle_map_ui=true` selects one isolated Android
trial and skips the long offline UI matrix. The Android map credential stays in
the existing build-secret path; the local service runtime receives no provider
key, billing identity, real account or production backend. No server directions,
place or payment requests are enabled. SDK tile loads are the approved real-map
use, with two fictional positions sent by a separately authenticated test driver.

The parent opens the actual active-ride screen. Each received coordinate is
checked through the real client gateway, then the SDK marker must be visible in
a loaded, nonblank native map. Two original window screenshots are required.
The green marker must move at least 24 pixels while both route-anchor bounds and
the map viewport remain fixed. A clipped pin, changed camera, copied screenshot,
wrong coordinate, blank raster or missing primary transfer rejects the result.

All test-phone restrictions still require their original confirmation and
restoration; the test-only administrator is removed afterward. A failed device
preparation is not retried or treated as map proof. Only the owned local runtime
is destroyed, after baseline records, other live rides and claims are checked.
Physical GPS, child positions, ETA, lock/background scenarios, provider tracking
and release acceptance remain explicitly outside this trial.
