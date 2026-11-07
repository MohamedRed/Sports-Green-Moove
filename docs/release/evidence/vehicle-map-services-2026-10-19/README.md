# Vehicle Coordinate Delivery And Validation

On 19 October the actual isolated callable run passed seven groups under run
`ca568aa470b7c3d26803f2212163e756`. Accounts and records belong only to
`demo-sgm-local-qa`. The primary CLI exited 0, the owned runtime was destroyed,
and all four service endpoints were verified closed before the final report.

The parent and driver received the selected vehicle's exact coordinates and
capture time. Missing, future, delayed, different-ride, different-driver and
child-role points never became a fabricated vehicle position. An unrelated or
unauthenticated account was refused. Removing participation removed access;
completion removed the active response. No child coordinates are added to this
DTO. This is not a claim about the separate raw child-location access policy,
which still needs the owner's privacy decision and its own authorization tests.

The first real trial found that `writeLocationBatch` did not reject latitude 91.
That original failure is retained in `../vehicle-map-invalid-coordinate-2026-10-19/`.
It does not establish that the invalid coordinate was persisted: the failed trial
did not retain that write's response. The fix validates both native and JSON
batches and independently protects the atomic writer used by all location
sources. A valid observation can replace an invalid stored coordinate; valid
stored points retain their observation-time ordering and acknowledgement rules.

The later completed run read back the finished trip, booking, two audit events
and exactly one zero-distance impact entry. All baseline flow records, all other
live rides and driver claims stayed unchanged; no reward was created.

The preceding parent observer screen run remains in
`../ride-observation-native-2026-10-19/`. Its images prove those earlier status
transitions, not the new vehicle marker. The marker implementation now consumes
only the validated vehicle point and uses the SDK's updating marker state; it
includes that point in map framing and distinguishes stale observations. Its
actual SDK rendering and movement have **not** been verified in this stage.
Cloud key metadata access returned 403; no permissions or credentials were
changed. The existing private key was not exposed or replaced.

The arrival estimate is moved below the map so it cannot cover pins. Its two
component layout cases are retained separately in `../vehicle-map-layout-2026-10-19/`.
Those cases do not validate route calculation, ETA accuracy or ETA expiry. The
full Android unit run passed 398 cases, and Functions passed 363. Real-device
foreground, background, locked-screen, outage and provider checks remain open.
No production deployment, manifest acceptance, payment or billing change was
made. No infrastructure change requires Terraform.
