# Vehicle Map Trial: Stale Accessibility Snapshot Confirmed

- Actual manual Native CI run: `39323641593`.
- Source: `d9267f367f7789ccc6cba655354fcda9e3a56937`.
- One native case failed at its first-point observation on 2026-10-19.
- All 17 original artifact files, the original failed job log, and authoritative
  run/artifact metadata are retained unchanged and hashed in `artifact-sha256.json`.

## Actual Diagnostic

The original failure JSON reports one visible map and one `Carte chargée` state,
with no loading state. Before clearing the accessibility cache, the test sees
zero departure, arrival and vehicle markers in its own application's window.
One successful cache clear, performed only after the case had already failed,
reveals exactly one of each named marker. All three real accessible bounds lie
fully inside the same map region. The reviewed PNG also shows the loaded map and
the three pins. No map, viewport, app state or test assertion is changed by the
diagnostic. It does not rerun the case or relabel this failure as passing.

This identifies a stale accessibility snapshot in this actual trial, rather than
missing map tiles or a demonstrated failure to display the first vehicle point.
It does not establish the cause of unrelated past failures.

## Correction And Remaining Scope

The observation helper now unconditionally refreshes the accessibility snapshot
before each normal marker read, and refuses an unsuccessful refresh. It queries
the exact fresh-vehicle label. There is no failed-query fallback or conditional
retry; the old unrefreshed helper is removed. Both route anchors, full visible
bounds, rendered green pixels, nonblank map, two actual points, unchanged camera,
minimum movement, sign-out, fixture isolation and cleanup remain required.

This trial never reached the second point, successful sign-out or final fixture
isolation. It has no positive device/host map report. The corrected observer must
be run separately before movement can be accepted. This record accepts no real
GPS, child coordinates, ETA, physical-device, store or safety-audit requirement.

The original device restore receipt is verified: map services unchanged,
location enabled, no active installation, temporary administration removed and
the original installation policy restored. The failed job log records service
shutdown, but there is no separate successful four-endpoint disposal receipt.
